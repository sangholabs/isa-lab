import { NextResponse } from "next/server";
import { redact } from "@/lib/research/providers";
import { PROVIDER_MAP, type ProviderId } from "@/lib/research/types";

export const dynamic = "force-dynamic";

/**
 * 모델 목록 조회.
 *
 * 모델 이름은 제공사가 수시로 바꾼다. 목록을 코드에 박아두면 반드시 낡는다.
 * 그래서 사용자 키로 제공사에 직접 물어본다. 여기서도 키는 저장하지 않는다.
 * Perplexity는 목록 API가 없어 코드에 든 후보를 그대로 돌려준다.
 */
// 2026-09-06 공식 문서 확인. sonar-reasoning은 폐기됐다.
const PERPLEXITY_MODELS = [
  "sonar-reasoning-pro",
  "sonar-pro",
  "sonar",
  "sonar-deep-research",
];

export async function POST(req: Request) {
  let body: { provider: ProviderId; apiKey: string };
  try {
    body = (await req.json()) as { provider: ProviderId; apiKey: string };
  } catch {
    return NextResponse.json({ error: "요청을 읽지 못했습니다" }, { status: 400 });
  }

  const meta = PROVIDER_MAP.get(body.provider);
  if (!meta) return NextResponse.json({ error: "알 수 없는 제공사입니다" }, { status: 400 });
  if (!body.apiKey && body.provider !== "perplexity") {
    return NextResponse.json({ error: "API 키가 필요합니다" }, { status: 400 });
  }

  try {
    const models = await listModels(body.provider, body.apiKey);
    return NextResponse.json({ provider: body.provider, models, source: sourceOf(body.provider) });
  } catch (err) {
    return NextResponse.json(
      { error: redact(err instanceof Error ? err.message : String(err)) },
      { status: 502 },
    );
  }
}

function sourceOf(p: ProviderId): "live" | "static" {
  return p === "perplexity" ? "static" : "live";
}

async function get(url: string, headers: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(text.slice(0, 300) || `HTTP ${res.status}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

async function listModels(provider: ProviderId, apiKey: string): Promise<string[]> {
  switch (provider) {
    case "perplexity":
      return PERPLEXITY_MODELS;

    case "openai": {
      const d = (await get("https://api.openai.com/v1/models", {
        Authorization: `Bearer ${apiKey}`,
      })) as { data?: { id: string }[] };
      return (d.data ?? [])
        .map((m) => m.id)
        // 임베딩·음성·이미지 모델은 이 화면에서 쓸 일이 없다
        .filter((id) => /^(gpt|o\d|chatgpt)/i.test(id))
        .filter((id) => !/(embedding|audio|tts|whisper|image|realtime|moderation)/i.test(id))
        .sort();
    }

    case "anthropic": {
      const d = (await get("https://api.anthropic.com/v1/models?limit=100", {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      })) as { data?: { id: string }[] };
      return (d.data ?? []).map((m) => m.id).sort();
    }

    case "gemini": {
      const d = (await get("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
        "x-goog-api-key": apiKey,
      })) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      return (d.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((id) => !/(embedding|aqa|imagen|veo|tts)/i.test(id))
        .sort();
    }
  }
}
