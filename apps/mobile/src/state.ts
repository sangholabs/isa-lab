import type { AssetKind } from "@isa-lab/tax-engine";
import { DEFAULT_RULE_SET_ID } from "@isa-lab/tax-engine";

/** 입력 화면의 자산군 순서와 라벨. 엔진의 AssetKind와 1:1. */
export const KINDS: { kind: AssetKind; label: string; hint: string }[] = [
  { kind: "kr_stock", label: "국내주식", hint: "매매차익 비과세 · ISA 가능" },
  { kind: "kr_etf_equity", label: "국내상장 국내주식형 ETF", hint: "매매차익 비과세 · ISA 가능" },
  { kind: "kr_etf_other", label: "국내상장 해외·채권 ETF", hint: "배당소득 15.4% · 손실 통산 불가 · ISA 가능" },
  { kind: "overseas_stock", label: "해외주식·해외 ETF", hint: "양도소득 22% · ISA 불가" },
  { kind: "crypto", label: "가상자산", hint: "2027년부터 22% · ISA 불가" },
];

export type Entry = { profit: string; loss: string }; // 만원 단위 문자열

export interface AppState {
  entries: Record<AssetKind, Entry>;
  year: 2026 | 2027;
  isaType: "isa_general" | "isa_low_income";
  ruleSetId: string;
  holdingSatisfied: boolean;
}

export const EMPTY_ENTRY: Entry = { profit: "", loss: "" };

export const initialState: AppState = {
  entries: {
    kr_stock: { ...EMPTY_ENTRY },
    kr_etf_equity: { ...EMPTY_ENTRY },
    kr_etf_other: { ...EMPTY_ENTRY },
    overseas_stock: { ...EMPTY_ENTRY },
    crypto: { ...EMPTY_ENTRY },
  },
  year: 2026,
  isaType: "isa_general",
  ruleSetId: DEFAULT_RULE_SET_ID,
  holdingSatisfied: true,
};

/** README의 예시 — 일반계좌 1,538,845원 vs ISA 0원이 나오는 조합에 가깝게. 첫 실행에서 결과를 바로 보여주는 용도. */
export const DEMO_STATE: AppState = {
  ...initialState,
  entries: {
    kr_stock: { profit: "150", loss: "" },
    kr_etf_equity: { profit: "", loss: "" },
    kr_etf_other: { profit: "1000", loss: "800" },
    overseas_stock: { profit: "", loss: "" },
    crypto: { profit: "", loss: "" },
  },
};

export const STORAGE_KEY = "deolnae.state.v1";
