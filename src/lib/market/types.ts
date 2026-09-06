/** 자산군. 세금·수수료·거래시간이 전부 다르기 때문에 최상위로 나눈다. */
export type AssetClass = "kr_stock" | "overseas_stock" | "crypto";

export interface Instrument {
  /** 앱 내부 식별자. 예) "kr:005930", "us:AAPL", "upbit:KRW-BTC" */
  id: string;
  assetClass: AssetClass;
  /** 거래소/데이터 소스에 넘기는 원 심볼 */
  symbol: string;
  name: string;
  currency: "KRW" | "USD";
  /** 국내주식만 해당 */
  market?: "KOSPI" | "KOSDAQ" | "KONEX";
}

export interface Quote {
  instrumentId: string;
  /** 표시통화 기준 현재가 */
  price: number;
  currency: "KRW" | "USD";
  previousClose: number | null;
  changePercent: number | null;
  /** 데이터를 어디서 가져왔는지 — 화면에 그대로 노출한다 */
  source: "upbit" | "yahoo";
  asOf: string;
  /** 이 값이 캐시에서 나왔는지. 외부 API가 죽었을 때 true가 된다 */
  stale: boolean;
}

/** 부분 실패를 감추지 않는다. 성공한 것과 실패한 것을 함께 돌려준다. */
export interface QuoteResult {
  quotes: Quote[];
  failures: { instrumentId: string; reason: string }[];
  fxKrwPerUsd: number | null;
  fxStale: boolean;
}
