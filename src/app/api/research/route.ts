import { NextResponse } from "next/server";
import { ASSET_MAP, KIND_LABEL, KIND_TAX_HINT } from "@/lib/universe";
import { buildPrompt, findDisagreements } from "@/lib/research/prompt";
import { callProvider, redact } from "@/lib/research/providers";
import { PROVIDER_MAP, type ProviderId, type ProviderResult } from "@/lib/research/types";
import { marketState, sinceLabel } from "@/lib/market/marketState";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Body {
  assetId: string;
  providers: { provider: ProviderId; apiKey: string; model?: string }[];
  quote?: { price: number; currency: "KRW" | "USD"; changePercent: number | null; asOf: string };
  priceKrw?: number | null;
  holding?: { quantity: number; avgCostKrw: number } | null;
}

/**
 * 리서치 프록시.
 *
 * 브라우저에서 LLM API를 직접 부를 수 없어(CORS) 서버를 거친다.
 * 키는 이 요청 안에서만 살아 있고 저장·로깅하지 않는다.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽지 못했습니다" }, { status: 400 });
  }

  const asset = ASSET_MAP.get(body.assetId ?? "");
  if (!asset) return NextResponse.json({ error: "알 수 없는 종목입니다" }, { status: 400 });

  const entries = (body.providers ?? []).filter((p) => p?.apiKey && PROVIDER_MAP.has(p.provider));
  if (entries.length === 0) {
    return NextResponse.json({ error: "API 키를 최소 하나 넣어주세요" }, { status: 400 });
  }
  if (entries.length > 4) {
    return NextResponse.json({ error: "한 번에 4개까지만 호출합니다" }, { status: 400 });
  }

  const q = body.quote;
  const state = marketState(asset.kind);
  const prompt = buildPrompt({
    name: asset.name,
    symbol: asset.symbol,
    kindLabel: KIND_LABEL[asset.kind],
    taxHint: KIND_TAX_HINT[asset.kind],
    priceText: q
      ? q.currency === "USD"
        ? `$${q.price.toLocaleString("en-US")}`
        : `${Math.round(q.price).toLocaleString("ko-KR")}원`
      : "시세를 가져오지 못함",
    changeText: q?.changePercent != null ? `전일 대비 ${q.changePercent.toFixed(2)}%` : "등락 미확인",
    asOfText: q ? `${new Date(q.asOf).toLocaleString("ko-KR")} (${sinceLabel(q.asOf)})` : "미확인",
    marketLabel: state.label,
    holdingText: body.holding
      ? `${body.holding.quantity}주(개), 평균 매입단가 ${Math.round(body.holding.avgCostKrw).toLocaleString("ko-KR")}원`
      : null,
    today: new Date().toLocaleDateString("ko-KR"),
  });

  const settled = await Promise.all(
    entries.map(async (e): Promise<ProviderResult> => {
      const meta = PROVIDER_MAP.get(e.provider)!;
      const model = (e.model || meta.defaultModel).trim();
      const started = Date.now();
      try {
        const analysis = await callProvider({
          provider: e.provider,
          apiKey: e.apiKey,
          model,
          prompt,
        });
        return { provider: e.provider, model, ok: true, analysis, elapsedMs: Date.now() - started };
      } catch (err) {
        return {
          provider: e.provider,
          model,
          ok: false,
          error: redact(err instanceof Error ? err.message : String(err)),
          elapsedMs: Date.now() - started,
        };
      }
    }),
  );

  const ok = settled.filter((r) => r.ok && r.analysis);
  const disagreements = findDisagreements(
    ok.map((r) => ({
      provider: PROVIDER_MAP.get(r.provider)!.label,
      confidence: r.analysis!.confidence,
      bullCount: r.analysis!.bull.length,
      bearCount: r.analysis!.bear.length,
    })),
  );

  return NextResponse.json({
    asset: { id: asset.id, name: asset.name, symbol: asset.symbol, kind: KIND_LABEL[asset.kind] },
    priceKrw: body.priceKrw ?? null,
    results: settled,
    disagreements,
    requestedAt: new Date().toISOString(),
  });
}
