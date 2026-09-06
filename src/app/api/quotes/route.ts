import { NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/market";
import type { Instrument } from "@/lib/market";
import { ASSET_MAP } from "@/lib/universe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * 시세 조회. 클라이언트가 자산 id 목록만 넘기면 소스는 서버가 고른다.
 * 브라우저에서 직접 부르지 않는 이유는 CORS와 레이트리밋을 한 곳에서
 * 통제하기 위해서다.
 */
export async function GET(req: Request) {
  const ids = new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids 파라미터가 필요합니다" }, { status: 400 });
  }
  if (ids.length > 40) {
    return NextResponse.json({ error: "한 번에 40개까지만 조회할 수 있습니다" }, { status: 400 });
  }

  const instruments: Instrument[] = [];
  const unknown: string[] = [];
  for (const id of ids) {
    const a = ASSET_MAP.get(id);
    if (!a) {
      unknown.push(id);
      continue;
    }
    instruments.push({
      id: a.id,
      assetClass: a.kind === "crypto" ? "crypto" : a.kind === "overseas_stock" ? "overseas_stock" : "kr_stock",
      symbol: a.symbol,
      name: a.name,
      currency: a.currency,
      market: a.krMarket,
    });
  }

  try {
    const result = await fetchQuotes(instruments);
    return NextResponse.json({
      ...result,
      failures: [...result.failures, ...unknown.map((id) => ({ instrumentId: id, reason: "알 수 없는 종목" }))],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "시세 조회에 실패했습니다" },
      { status: 502 },
    );
  }
}
