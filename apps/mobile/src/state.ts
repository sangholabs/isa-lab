import type { AssetKind, TaxRuleSet } from "@isa-lab/tax-engine";
import { DEFAULT_RULE_SET_ID, getRuleSet } from "@isa-lab/tax-engine";
import { pct } from "./format";

/** 입력 화면의 자산군 순서·라벨·힌트. 엔진의 AssetKind와 1:1. 세율은 룰셋에서 읽는다. */
export const KINDS: { kind: AssetKind; label: string; hint: (r: TaxRuleSet) => string }[] = [
  { kind: "kr_stock", label: "국내주식", hint: () => "매매차익 비과세 · ISA 가능" },
  { kind: "kr_etf_equity", label: "국내상장 국내주식형 ETF", hint: () => "매매차익 비과세 · ISA 가능" },
  { kind: "kr_etf_other", label: "국내상장 해외·채권 ETF", hint: (r) => `배당소득 ${pct(r.krDividendTaxRate.value)} · 손실 통산 불가 · ISA 가능` },
  { kind: "overseas_stock", label: "해외주식·해외 ETF", hint: (r) => `양도소득 ${pct(r.overseasCapitalGainTaxRate.value)} · ISA 불가` },
  { kind: "crypto", label: "가상자산", hint: (r) => `${r.cryptoTaxStartYear.value}년부터 ${pct(r.cryptoTaxRate.value)} · ISA 불가` },
];

export type Entry = { profit: string; loss: string }; // 만원 단위 문자열

export interface AppState {
  entries: Record<AssetKind, Entry>;
  year: 2026 | 2027;
  isaType: "isa_general" | "isa_low_income";
  ruleSetId: string;
  holdingSatisfied: boolean;
}

const E: Entry = { profit: "", loss: "" }; // 항목은 늘 통째로 바꿔 끼우므로 공유해도 된다

export const initialState: AppState = {
  entries: { kr_stock: E, kr_etf_equity: E, kr_etf_other: E, overseas_stock: E, crypto: E },
  year: 2026,
  isaType: "isa_general",
  ruleSetId: DEFAULT_RULE_SET_ID,
  holdingSatisfied: true,
};

/** 「예시로 보기」 — 해외·채권 ETF 손실이 통산되지 않는 효과가 드러나는 조합. 현행·일반형이면 일반계좌 1,540,000원 vs ISA 0원 (tests/mobile.test.ts) */
export const DEMO_ENTRIES: AppState["entries"] = {
  ...initialState.entries,
  kr_stock: { profit: "150", loss: "" },
  kr_etf_other: { profit: "1000", loss: "800" },
};

export const STORAGE_KEY = "deolnae.state.v1";

/** 기기 저장본 → 상태. 깨졌거나 모양이 어긋나도 앱은 열려야 한다 — 모르는 값은 기본값으로 메운다 */
// ponytail: 필드가 늘어나는 건 여기서 흡수된다. 필드 뜻이 바뀌면 그때 v2 키 + 마이그레이션
export function restore(raw: string | null): AppState {
  try {
    const p = JSON.parse(raw ?? "null");
    if (!p || typeof p !== "object") return initialState;
    return { ...initialState, ...p, entries: { ...initialState.entries, ...p.entries }, ruleSetId: getRuleSet(p.ruleSetId).id };
  } catch {
    return initialState;
  }
}
