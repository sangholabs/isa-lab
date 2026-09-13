/**
 * 자산 종류. 세금이 갈리는 지점을 기준으로 나눴다.
 * "국내 ETF"를 한 덩어리로 두면 계산이 틀린다 —
 * 국내주식형 ETF는 매매차익이 비과세인데, 해외/채권형 ETF는 15.4% 배당소득이다.
 */
export type AssetKind =
  | "kr_stock" // 국내 상장 주식 (소액주주 매매차익 비과세, 매도 시 증권거래세)
  | "kr_etf_equity" // 국내상장 국내주식형 ETF (매매차익 비과세, 증권거래세 면제)
  | "kr_etf_other" // 국내상장 해외·채권·원자재 ETF (매매차익 배당소득 15.4%, 거래세 면제)
  | "overseas_stock" // 해외 상장 주식·ETF (양도소득세 22%, 연 250만원 공제)
  | "crypto"; // 가상자산

export type AccountType = "regular" | "isa_general" | "isa_low_income";

/** ISA(중개형)에서 담을 수 있는 자산 — 해외주식 직접투자와 코인은 담기지 않는다. */
export const ISA_ELIGIBLE: readonly AssetKind[] = ["kr_stock", "kr_etf_equity", "kr_etf_other"];

export function isIsa(a: AccountType): boolean {
  return a === "isa_general" || a === "isa_low_income";
}

export interface RealizedPnl {
  kind: AssetKind;
  /** 실현손익 (원). 손실이면 음수. 수수료·거래세를 뺀 뒤의 값. */
  amount: number;
}

export interface TaxBreakdownLine {
  label: string;
  taxableBase: number;
  rate: number;
  tax: number;
  note: string;
}

export interface TaxResult {
  totalTax: number;
  lines: TaxBreakdownLine[];
  /** 계산에 쓴 가정 — 화면에 그대로 보여준다 */
  assumptions: string[];
}
