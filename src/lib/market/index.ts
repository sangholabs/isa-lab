import { fetchUpbitQuotes } from "./upbit";
import { fetchUsdKrw, fetchYahooQuote } from "./yahoo";
import type { Instrument, QuoteResult } from "./types";

export * from "./types";
export { listKrwMarkets } from "./upbit";

/**
 * 자산군이 섞인 목록을 받아 소스별로 나눠 부르고, 하나가 실패해도
 * 나머지는 그대로 돌려준다. 화면이 통째로 비는 것보다 낫다.
 */
export async function fetchQuotes(instruments: Instrument[]): Promise<QuoteResult> {
  const crypto = instruments.filter((i) => i.assetClass === "crypto");
  const viaYahoo = instruments.filter((i) => i.assetClass !== "crypto");

  const failures: QuoteResult["failures"] = [];

  const [cryptoRes, fxRes, ...yahooRes] = await Promise.allSettled([
    crypto.length ? fetchUpbitQuotes(crypto.map((i) => i.symbol)) : Promise.resolve([]),
    viaYahoo.length ? fetchUsdKrw() : Promise.resolve(null),
    ...viaYahoo.map((i) => fetchYahooQuote(i.id, i.symbol)),
  ]);

  const quotes: QuoteResult["quotes"] = [];

  if (cryptoRes.status === "fulfilled") quotes.push(...cryptoRes.value);
  else for (const i of crypto) failures.push({ instrumentId: i.id, reason: reason(cryptoRes.reason) });

  yahooRes.forEach((res, idx) => {
    const inst = viaYahoo[idx];
    if (res.status === "fulfilled") quotes.push(res.value);
    else failures.push({ instrumentId: inst.id, reason: reason(res.reason) });
  });

  const fx = fxRes.status === "fulfilled" ? fxRes.value : null;

  return {
    quotes,
    failures,
    fxKrwPerUsd: fx?.rate ?? null,
    fxStale: fx?.stale ?? true,
  };
}

function reason(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 표시통화가 달라도 원화로 환산해 한 줄에 놓기 위한 헬퍼 */
export function toKrw(amount: number, currency: "KRW" | "USD", fxKrwPerUsd: number | null): number | null {
  if (currency === "KRW") return amount;
  if (fxKrwPerUsd == null) return null;
  return amount * fxKrwPerUsd;
}
