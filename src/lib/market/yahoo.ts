import { fetchJson, withCache } from "./http";
import type { Quote } from "./types";

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

interface YahooChart {
  chart: {
    result?: Array<{
      meta: {
        symbol: string;
        currency: string;
        regularMarketPrice: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime: number;
      };
    }>;
    error?: { description?: string } | null;
  };
}

/**
 * 국내주식은 `005930.KS`(코스피) / `.KQ`(코스닥), 해외주식은 티커 그대로.
 * 한 번에 한 종목씩 부른다 — 배치 엔드포인트는 인증을 요구해서 쓰지 않는다.
 */
export async function fetchYahooQuote(instrumentId: string, symbol: string): Promise<Quote> {
  const { value, stale } = await withCache(`yahoo:${symbol}`, 15_000, () =>
    fetchJson<YahooChart>(`${BASE}/${encodeURIComponent(symbol)}?range=5d&interval=1d`, {
      minIntervalMs: 250,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; isa-lab/0.1)" },
    }),
  );

  const r = value.chart.result?.[0];
  if (!r) throw new Error(value.chart.error?.description ?? `${symbol}: 시세를 찾지 못했습니다`);

  const price = r.meta.regularMarketPrice;
  const prev = r.meta.chartPreviousClose ?? r.meta.previousClose ?? null;
  return {
    instrumentId,
    price,
    currency: r.meta.currency === "KRW" ? "KRW" : "USD",
    previousClose: prev,
    changePercent: prev ? ((price - prev) / prev) * 100 : null,
    source: "yahoo",
    asOf: new Date(r.meta.regularMarketTime * 1000).toISOString(),
    stale,
  };
}

/** 원/달러 환율. 해외주식을 원화로 환산할 때 쓴다. */
export async function fetchUsdKrw(): Promise<{ rate: number; stale: boolean }> {
  const { value, stale } = await withCache("yahoo:KRW=X", 60_000, () =>
    fetchJson<YahooChart>(`${BASE}/KRW=X?range=1d&interval=1d`, {
      minIntervalMs: 250,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; isa-lab/0.1)" },
    }),
  );
  const r = value.chart.result?.[0];
  if (!r) throw new Error("환율을 가져오지 못했습니다");
  return { rate: r.meta.regularMarketPrice, stale };
}
