import type { Asset } from "@/lib/portfolio/types";

/**
 * 기본 종목 목록.
 *
 * ETF를 "국내주식형"과 "기타(해외·채권·원자재)"로 나눠 둔 게 핵심이다.
 * 겉보기에는 똑같은 국내상장 ETF지만 매매차익 과세가 정반대다.
 */
export const UNIVERSE: Asset[] = [
  // 국내 주식 — 매매차익 비과세, 매도 시 증권거래세
  { id: "kr:005930", kind: "kr_stock", symbol: "005930.KS", name: "삼성전자", currency: "KRW", krMarket: "KOSPI" },
  { id: "kr:000660", kind: "kr_stock", symbol: "000660.KS", name: "SK하이닉스", currency: "KRW", krMarket: "KOSPI" },
  { id: "kr:035720", kind: "kr_stock", symbol: "035720.KS", name: "카카오", currency: "KRW", krMarket: "KOSPI" },
  { id: "kr:035420", kind: "kr_stock", symbol: "035420.KS", name: "NAVER", currency: "KRW", krMarket: "KOSPI" },
  { id: "kr:247540", kind: "kr_stock", symbol: "247540.KQ", name: "에코프로비엠", currency: "KRW", krMarket: "KOSDAQ" },
  { id: "kr:091990", kind: "kr_stock", symbol: "091990.KQ", name: "셀트리온헬스케어", currency: "KRW", krMarket: "KOSDAQ" },

  // 국내상장 국내주식형 ETF — 매매차익 비과세
  { id: "kr:069500", kind: "kr_etf_equity", symbol: "069500.KS", name: "KODEX 200", currency: "KRW", krMarket: "KOSPI" },
  { id: "kr:229200", kind: "kr_etf_equity", symbol: "229200.KS", name: "KODEX 코스닥150", currency: "KRW", krMarket: "KOSPI" },

  // 국내상장 해외·채권 ETF — 매매차익이 배당소득 15.4%. ISA의 절세가 여기서 나온다.
  { id: "kr:360750", kind: "kr_etf_other", symbol: "360750.KS", name: "TIGER 미국S&P500", currency: "KRW", krMarket: "KOSPI" },
  { id: "kr:379800", kind: "kr_etf_other", symbol: "379800.KS", name: "KODEX 미국S&P500", currency: "KRW", krMarket: "KOSPI" },
  { id: "kr:133690", kind: "kr_etf_other", symbol: "133690.KS", name: "TIGER 미국나스닥100", currency: "KRW", krMarket: "KOSPI" },
  { id: "kr:305080", kind: "kr_etf_other", symbol: "305080.KS", name: "TIGER 미국채10년선물", currency: "KRW", krMarket: "KOSPI" },

  // 해외 상장 — 양도소득세 22%, ISA에는 담기지 않는다
  { id: "us:AAPL", kind: "overseas_stock", symbol: "AAPL", name: "Apple", currency: "USD" },
  { id: "us:MSFT", kind: "overseas_stock", symbol: "MSFT", name: "Microsoft", currency: "USD" },
  { id: "us:NVDA", kind: "overseas_stock", symbol: "NVDA", name: "NVIDIA", currency: "USD" },
  { id: "us:VOO", kind: "overseas_stock", symbol: "VOO", name: "Vanguard S&P 500 ETF", currency: "USD" },

  // 가상자산 — 업비트 원화마켓
  { id: "upbit:KRW-BTC", kind: "crypto", symbol: "KRW-BTC", name: "비트코인", currency: "KRW" },
  { id: "upbit:KRW-ETH", kind: "crypto", symbol: "KRW-ETH", name: "이더리움", currency: "KRW" },
  { id: "upbit:KRW-SOL", kind: "crypto", symbol: "KRW-SOL", name: "솔라나", currency: "KRW" },
  { id: "upbit:KRW-XRP", kind: "crypto", symbol: "KRW-XRP", name: "리플", currency: "KRW" },
];

export const ASSET_MAP = new Map(UNIVERSE.map((a) => [a.id, a]));

export const KIND_LABEL: Record<Asset["kind"], string> = {
  kr_stock: "국내주식",
  kr_etf_equity: "국내주식형 ETF",
  kr_etf_other: "국내상장 해외·채권 ETF",
  overseas_stock: "해외주식",
  crypto: "가상자산",
};

/** 과세가 어떻게 되는지 한 줄 설명 — 화면에 배지로 붙인다 */
export const KIND_TAX_HINT: Record<Asset["kind"], string> = {
  kr_stock: "매매차익 비과세 · 매도 시 거래세 0.20%",
  kr_etf_equity: "매매차익 비과세 · 거래세 면제",
  kr_etf_other: "매매차익 배당소득 15.4% · 손익통산 불가",
  overseas_stock: "양도세 22% · 연 250만원 공제 · ISA 불가",
  crypto: "2027년부터 과세 · ISA 불가",
};

export const DEFAULT_WATCHLIST = [
  "kr:005930",
  "kr:360750",
  "kr:069500",
  "us:NVDA",
  "upbit:KRW-BTC",
];
