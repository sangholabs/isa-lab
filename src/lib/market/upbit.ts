import { fetchJson, withCache } from "./http";
import type { Instrument, Quote } from "./types";

const BASE = "https://api.upbit.com/v1";

interface UpbitMarket {
  market: string;
  korean_name: string;
  english_name: string;
}

interface UpbitTicker {
  market: string;
  trade_price: number;
  prev_closing_price: number;
  signed_change_rate: number;
  timestamp: number;
}

/** KRW 마켓만 쓴다. BTC/USDT 마켓은 원화 환산이 한 단계 더 필요해 v1에서는 제외. */
export async function listKrwMarkets(): Promise<Instrument[]> {
  const { value } = await withCache("upbit:markets", 6 * 60 * 60 * 1000, () =>
    fetchJson<UpbitMarket[]>(`${BASE}/market/all?isDetails=false`, { minIntervalMs: 200 }),
  );
  return value
    .filter((m) => m.market.startsWith("KRW-"))
    .map((m) => ({
      id: `upbit:${m.market}`,
      assetClass: "crypto" as const,
      symbol: m.market,
      name: m.korean_name,
      currency: "KRW" as const,
    }));
}

export async function fetchUpbitQuotes(markets: string[]): Promise<Quote[]> {
  if (markets.length === 0) return [];
  const key = `upbit:ticker:${[...markets].sort().join(",")}`;
  const { value, stale } = await withCache(key, 5000, () =>
    fetchJson<UpbitTicker[]>(`${BASE}/ticker?markets=${markets.join(",")}`, { minIntervalMs: 150 }),
  );
  return value.map((t) => ({
    instrumentId: `upbit:${t.market}`,
    price: t.trade_price,
    currency: "KRW" as const,
    previousClose: t.prev_closing_price,
    changePercent: t.signed_change_rate * 100,
    source: "upbit" as const,
    asOf: new Date(t.timestamp).toISOString(),
    stale,
  }));
}
