import { computeAnnualTax, computeTradeCost, type FeeConfig } from "@/lib/tax/engine";
import type { TaxRuleSet } from "@/lib/tax/rules";
import type { AssetKind } from "@/lib/tax/types";
import { ISA_ELIGIBLE } from "@/lib/tax/types";

/**
 * 세후 시나리오.
 *
 * LLM이 못 하는 계산이다. 이 앱이 실제로 더할 수 있는 건
 * "얼마나 오를까"가 아니라 "그만큼 올랐을 때 손에 뭐가 남는가"다.
 * 전부 결정론적이라 같은 입력에 같은 답이 나온다.
 */

export interface ScenarioRow {
  changePct: number;
  /** 매수·매도 비용을 뺀 실현손익 (원) */
  grossKrw: number;
  regularTaxKrw: number;
  regularNetKrw: number;
  isaTaxKrw: number | null;
  isaNetKrw: number | null;
  savedKrw: number | null;
}

export interface ScenarioResult {
  investKrw: number;
  isaEligible: boolean;
  rows: ScenarioRow[];
  note: string;
}

const STEPS = [-30, -20, -10, 10, 20, 30];

export function buildScenario(params: {
  kind: AssetKind;
  krMarket?: "KOSPI" | "KOSDAQ" | "KONEX";
  investKrw: number;
  rules: TaxRuleSet;
  fees: FeeConfig;
  year: number;
  /** 이 해에 이미 실현한 같은 종류의 손익 — 공제·한도가 이미 얼마나 쓰였는지 반영 */
  existingRealized?: { kind: AssetKind; amount: number }[];
}): ScenarioResult {
  const { kind, krMarket, investKrw, rules, fees, year } = params;
  const existing = params.existingRealized ?? [];
  const isaEligible = ISA_ELIGIBLE.includes(kind);

  const buyCost = computeTradeCost({ kind, side: "buy", notional: investKrw, krMarket, fees, rules }).total;

  const rows = STEPS.map((changePct) => {
    const exitValue = investKrw * (1 + changePct / 100);
    const sellCost = computeTradeCost({
      kind,
      side: "sell",
      notional: exitValue,
      krMarket,
      fees,
      rules,
    }).total;
    const grossKrw = exitValue - investKrw - buyCost - sellCost;

    const withThis = [...existing, { kind, amount: grossKrw }];
    const baseTax = computeAnnualTax({ account: "regular", realized: existing, rules, year }).totalTax;
    const regularTax =
      computeAnnualTax({ account: "regular", realized: withThis, rules, year }).totalTax - baseTax;

    let isaTax: number | null = null;
    if (isaEligible) {
      const isaExisting = existing.filter((r) => ISA_ELIGIBLE.includes(r.kind));
      const isaBase = computeAnnualTax({
        account: "isa_general",
        realized: isaExisting,
        rules,
        year,
      }).totalTax;
      isaTax =
        computeAnnualTax({
          account: "isa_general",
          realized: [...isaExisting, { kind, amount: grossKrw }],
          rules,
          year,
        }).totalTax - isaBase;
    }

    return {
      changePct,
      grossKrw,
      regularTaxKrw: regularTax,
      regularNetKrw: grossKrw - regularTax,
      isaTaxKrw: isaTax,
      isaNetKrw: isaTax == null ? null : grossKrw - isaTax,
      savedKrw: isaTax == null ? null : regularTax - isaTax,
    };
  });

  const note = isaEligible
    ? "매수·매도 수수료와 세금을 모두 뺀 금액입니다. ISA는 일반형 비과세 한도 기준이고, 의무보유 3년을 채웠다고 가정했습니다."
    : "이 자산은 ISA에 담을 수 없어 일반계좌 기준만 계산했습니다.";

  return { investKrw, isaEligible, rows, note };
}
