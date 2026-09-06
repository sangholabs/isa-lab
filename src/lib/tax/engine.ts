import type { TaxRuleSet, KrMarket } from "./rules";
import type { AccountType, AssetKind, RealizedPnl, TaxBreakdownLine, TaxResult } from "./types";
import { ISA_ELIGIBLE, isIsa } from "./types";

/* ------------------------------------------------------------------ */
/* 거래 비용 — 체결 시점에 바로 빠지는 돈                              */
/* ------------------------------------------------------------------ */

export interface FeeConfig {
  /** 국내주식 위탁수수료율 (증권사마다 다르다. 기본값은 흔한 온라인 요율) */
  krBrokerFeeRate: number;
  /** 해외주식 위탁수수료율 */
  overseasBrokerFeeRate: number;
  /** 환전 스프레드 (편도) */
  fxSpreadRate: number;
  /** 업비트 KRW 마켓 수수료율 (양방향) */
  cryptoFeeRate: number;
}

export const DEFAULT_FEES: FeeConfig = {
  krBrokerFeeRate: 0.00015,
  overseasBrokerFeeRate: 0.0007,
  fxSpreadRate: 0.001,
  cryptoFeeRate: 0.0005,
};

export interface TradeCostInput {
  kind: AssetKind;
  side: "buy" | "sell";
  /** 체결 대금 (표시통화 기준) */
  notional: number;
  krMarket?: KrMarket;
  fees?: FeeConfig;
  rules: TaxRuleSet;
}

export interface TradeCost {
  brokerFee: number;
  transactionTax: number;
  fxSpread: number;
  total: number;
  notes: string[];
}

/** ETF는 세법상 신탁형 펀드라 증권거래세를 물지 않는다. */
function hasTransactionTax(kind: AssetKind): boolean {
  return kind === "kr_stock";
}

export function computeTradeCost(input: TradeCostInput): TradeCost {
  const fees = input.fees ?? DEFAULT_FEES;
  const notes: string[] = [];
  let brokerFee = 0;
  let transactionTax = 0;
  let fxSpread = 0;

  switch (input.kind) {
    case "kr_stock":
    case "kr_etf_equity":
    case "kr_etf_other": {
      brokerFee = input.notional * fees.krBrokerFeeRate;
      if (input.side === "sell" && hasTransactionTax(input.kind)) {
        const market: KrMarket = input.krMarket ?? "KOSPI";
        const rate = input.rules.krSellTaxRate[market].value;
        transactionTax = input.notional * rate;
        notes.push(`${market} 매도 증권거래세 ${(rate * 100).toFixed(2)}%`);
      } else if (input.side === "sell") {
        notes.push("ETF는 증권거래세 면제");
      }
      break;
    }
    case "overseas_stock": {
      brokerFee = input.notional * fees.overseasBrokerFeeRate;
      fxSpread = input.notional * fees.fxSpreadRate;
      notes.push(`환전 스프레드 ${(fees.fxSpreadRate * 100).toFixed(2)}% 편도 반영`);
      break;
    }
    case "crypto": {
      brokerFee = input.notional * fees.cryptoFeeRate;
      break;
    }
  }

  return {
    brokerFee,
    transactionTax,
    fxSpread,
    total: brokerFee + transactionTax + fxSpread,
    notes,
  };
}

/* ------------------------------------------------------------------ */
/* 연간 정산 — 실현손익에 붙는 세금                                     */
/* ------------------------------------------------------------------ */

export interface AnnualTaxInput {
  account: AccountType;
  /** 그 해 실현손익 목록 (원화 환산 후) */
  realized: RealizedPnl[];
  rules: TaxRuleSet;
  /** 정산 대상 연도 — 가상자산 과세 시작 여부를 판단한다 */
  year: number;
  /** ISA 의무보유기간을 채웠는지. 못 채우고 해지하면 혜택이 사라진다. */
  isaHoldingSatisfied?: boolean;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pick = (r: RealizedPnl[], kinds: AssetKind[]) =>
  r.filter((x) => kinds.includes(x.kind)).map((x) => x.amount);

/**
 * 일반계좌 정산.
 *
 * 여기서 가장 자주 틀리는 지점: 국내상장 해외ETF의 매매차익은 '배당소득'이라
 * 손실과 통산되지 않는다. 이익 난 건에만 15.4%가 붙고, 손실 난 건은 그냥 손실이다.
 * ISA와의 차이가 바로 여기서 생긴다.
 */
function taxRegular(input: AnnualTaxInput): TaxResult {
  const { rules, realized, year } = input;
  const lines: TaxBreakdownLine[] = [];
  const assumptions: string[] = [];

  // 1) 국내주식·국내주식형 ETF 매매차익 — 소액주주는 비과세
  const krExempt = sum(pick(realized, ["kr_stock", "kr_etf_equity"]));
  if (krExempt !== 0) {
    lines.push({
      label: "국내주식·국내주식형 ETF 매매차익",
      taxableBase: 0,
      rate: 0,
      tax: 0,
      note: "소액주주 매매차익 비과세",
    });
    assumptions.push("대주주가 아닌 소액주주로 가정했습니다.");
  }

  // 2) 국내상장 해외·기타 ETF — 손익통산 없이 이익분에만 배당소득세
  const otherEtf = pick(realized, ["kr_etf_other"]);
  const otherEtfGain = sum(otherEtf.filter((v) => v > 0));
  if (otherEtf.length > 0) {
    const rate = rules.krDividendTaxRate.value;
    lines.push({
      label: "국내상장 해외·채권 ETF 매매차익",
      taxableBase: otherEtfGain,
      rate,
      tax: otherEtfGain * rate,
      note: "배당소득으로 과세되어 손실과 통산되지 않습니다",
    });
  }

  // 3) 해외주식 — 통산 후 기본공제
  const overseas = sum(pick(realized, ["overseas_stock"]));
  if (overseas !== 0) {
    const deduction = rules.overseasCapitalGainDeduction.value;
    const rate = rules.overseasCapitalGainTaxRate.value;
    const base = Math.max(0, overseas - deduction);
    lines.push({
      label: "해외주식 양도소득",
      taxableBase: base,
      rate,
      tax: base * rate,
      note: `손익통산 후 기본공제 ${deduction.toLocaleString("ko-KR")}원 차감`,
    });
  }

  // 4) 가상자산 — 과세 시작 연도 전에는 0
  const crypto = sum(pick(realized, ["crypto"]));
  if (crypto !== 0) {
    const startYear = rules.cryptoTaxStartYear.value;
    if (year < startYear) {
      lines.push({
        label: "가상자산 소득",
        taxableBase: 0,
        rate: 0,
        tax: 0,
        note: `${startYear}년부터 과세 예정 (${year}년은 비과세)`,
      });
    } else {
      const deduction = rules.cryptoDeduction.value;
      const rate = rules.cryptoTaxRate.value;
      const base = Math.max(0, crypto - deduction);
      lines.push({
        label: "가상자산 소득",
        taxableBase: base,
        rate,
        tax: base * rate,
        note: `기본공제 ${deduction.toLocaleString("ko-KR")}원 차감`,
      });
    }
  }

  return { totalTax: sum(lines.map((l) => l.tax)), lines, assumptions };
}

/**
 * ISA 정산.
 *
 * ISA의 실익은 두 가지다.
 *  (1) 계좌 안의 과세대상 손익을 전부 통산한다 — 일반계좌에서는 통산이 막히는
 *      국내상장 해외ETF 손실도 여기서는 이익과 상계된다.
 *  (2) 통산한 순이익에서 비과세 한도를 빼고, 남은 금액에만 9.9%가 붙는다.
 *
 * 국내주식·국내주식형 ETF 매매차익은 일반계좌에서도 원래 비과세라
 * 통산 대상에서 뺐다. (아래 assumptions에 명시)
 */
function taxIsa(input: AnnualTaxInput): TaxResult {
  const { rules, realized, account } = input;
  const isa = rules.isa;
  const assumptions: string[] = [
    "ISA 계좌 안의 과세대상 손익만 통산했습니다. 국내주식·국내주식형 ETF 매매차익은 일반계좌에서도 비과세이므로 통산 대상에서 제외했습니다.",
  ];

  if (input.isaHoldingSatisfied === false) {
    const fallback = taxRegular({ ...input, account: "regular" });
    return {
      ...fallback,
      assumptions: [
        ...fallback.assumptions,
        `의무보유기간 ${isa.mandatoryHoldingYears.value}년을 채우지 못해 ISA 혜택 없이 일반계좌 기준으로 계산했습니다.`,
      ],
    };
  }

  const taxableNet = sum(pick(realized, ["kr_etf_other"]));
  const exemptLimit =
    account === "isa_low_income" ? isa.taxFreeLimitLowIncome.value : isa.taxFreeLimitGeneral.value;
  const overLimit = Math.max(0, taxableNet - exemptLimit);
  const rate = isa.separateTaxRate.value;

  const lines: TaxBreakdownLine[] = [];

  const krExempt = sum(pick(realized, ["kr_stock", "kr_etf_equity"]));
  if (krExempt !== 0) {
    lines.push({
      label: "국내주식·국내주식형 ETF 매매차익",
      taxableBase: 0,
      rate: 0,
      tax: 0,
      note: "원래 비과세 — ISA 여부와 무관",
    });
  }

  lines.push({
    label: "ISA 통산 순이익",
    taxableBase: Math.max(0, taxableNet),
    rate: 0,
    tax: 0,
    note:
      taxableNet < 0
        ? "통산 결과 손실이라 과세 대상이 없습니다"
        : `비과세 한도 ${exemptLimit.toLocaleString("ko-KR")}원 적용`,
  });

  if (overLimit > 0) {
    lines.push({
      label: "비과세 한도 초과분",
      taxableBase: overLimit,
      rate,
      tax: overLimit * rate,
      note: `${(rate * 100).toFixed(1)}% 분리과세`,
    });
  }

  return { totalTax: sum(lines.map((l) => l.tax)), lines, assumptions };
}

export function computeAnnualTax(input: AnnualTaxInput): TaxResult {
  return isIsa(input.account) ? taxIsa(input) : taxRegular(input);
}

/** 같은 실현손익을 일반계좌와 ISA로 각각 굴렸을 때의 차이 */
export interface IsaComparison {
  regular: TaxResult;
  isa: TaxResult;
  saved: number;
  /** ISA에 담을 수 없어 비교에서 뺀 자산군 */
  excludedKinds: AssetKind[];
}

/**
 * 비교는 ISA에 담을 수 있는 자산만 놓고 한다.
 * 해외주식·코인까지 넣고 "ISA면 세금이 이만큼 줄었다"고 말하면 거짓말이 된다 —
 * 애초에 ISA로는 그 자산을 살 수 없기 때문이다.
 */
export function compareIsa(
  input: Omit<AnnualTaxInput, "account"> & { isaType?: Extract<AccountType, `isa_${string}`> },
): IsaComparison {
  const eligible = input.realized.filter((r) => ISA_ELIGIBLE.includes(r.kind));
  const excludedKinds = [...new Set(input.realized.filter((r) => !ISA_ELIGIBLE.includes(r.kind)).map((r) => r.kind))];
  const regular = computeAnnualTax({ ...input, realized: eligible, account: "regular" });
  const isa = computeAnnualTax({ ...input, realized: eligible, account: input.isaType ?? "isa_general" });
  return { regular, isa, saved: regular.totalTax - isa.totalTax, excludedKinds };
}
