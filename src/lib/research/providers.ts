import type { Analysis, ProviderId } from "./types";

/**
 * LLM 호출 어댑터.
 *
 * 키는 요청마다 클라이언트에서 받아 그대로 흘려보내고 어디에도 저장하지 않는다.
 * 로그에도 남기지 않는다 — 에러 메시지를 그대로 노출하기 때문에,
 * 혹시 키가 섞여 들어오면 지운 뒤 내보낸다(redact).
 */

export class ProviderError extends Error {}

const TIMEOUT_MS = 90_000;

async function post(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const text = await res.text();
    if (!res.ok) {
      throw new ProviderError(shorten(text) || `HTTP ${res.status}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderError("응답을 JSON으로 읽지 못했습니다");
    }
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ProviderError("응답이 90초를 넘어 중단했습니다");
    }
    throw new ProviderError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

function shorten(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 400 ? `${t.slice(0, 400)}…` : t;
}

/** 에러 문구에 키가 섞여 나가지 않게 지운다 */
export function redact(message: string): string {
  return message
    .replace(/sk-ant-[A-Za-z0-9\-_]{8,}/g, "sk-ant-***")
    .replace(/sk-[A-Za-z0-9\-_]{8,}/g, "sk-***")
    .replace(/pplx-[A-Za-z0-9\-_]{8,}/g, "pplx-***")
    .replace(/AIza[A-Za-z0-9\-_]{8,}/g, "AIza***");
}

/** 모델이 코드블록으로 감싸 보내는 경우가 잦아서 벗겨낸다 */
function parseAnalysis(raw: string): Analysis {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1) throw new ProviderError("JSON을 찾지 못했습니다");
  s = s.slice(first, last + 1);

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(s) as Record<string, unknown>;
  } catch {
    throw new ProviderError("JSON 형식이 깨져 있습니다");
  }

  const claims = (v: unknown) =>
    Array.isArray(v)
      ? v
          .map((x) => {
            const o = (x ?? {}) as Record<string, unknown>;
            return { point: String(o.point ?? ""), evidence: String(o.evidence ?? "") };
          })
          .filter((c) => c.point)
      : [];

  const strings = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];

  const conf = Number(obj.confidence);

  return {
    summary: String(obj.summary ?? "").trim(),
    bull: claims(obj.bull),
    bear: claims(obj.bear),
    scenarios: Array.isArray(obj.scenarios)
      ? obj.scenarios
          .map((x) => {
            const o = (x ?? {}) as Record<string, unknown>;
            return { condition: String(o.condition ?? ""), implication: String(o.implication ?? "") };
          })
          .filter((s2) => s2.condition)
      : [],
    watchItems: strings(obj.watchItems),
    unknowns: strings(obj.unknowns),
    confidence: Number.isFinite(conf) ? Math.max(0, Math.min(100, Math.round(conf))) : 50,
    sources: strings(obj.sources),
  };
}

async function openaiLike(params: {
  url: string;
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<Analysis> {
  const data = (await post(params.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: [{ role: "user", content: params.prompt }],
    }),
  })) as { choices?: { message?: { content?: string } }[] };

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new ProviderError("빈 응답을 받았습니다");
  return parseAnalysis(text);
}

async function anthropic(params: { apiKey: string; model: string; prompt: string }): Promise<Analysis> {
  const data = (await post("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: params.prompt }],
    }),
  })) as { content?: { type: string; text?: string }[] };

  const text = data.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  if (!text) throw new ProviderError("빈 응답을 받았습니다");
  return parseAnalysis(text);
}

async function gemini(params: { apiKey: string; model: string; prompt: string }): Promise<Analysis> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    params.model,
  )}:generateContent`;
  const data = (await post(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": params.apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: params.prompt }] }],
      generationConfig: { temperature: 0.4 },
    }),
  })) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new ProviderError("빈 응답을 받았습니다");
  return parseAnalysis(text);
}

export async function callProvider(params: {
  provider: ProviderId;
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<Analysis> {
  const { provider, apiKey, model, prompt } = params;
  switch (provider) {
    case "openai":
      return openaiLike({ url: "https://api.openai.com/v1/chat/completions", apiKey, model, prompt });
    case "perplexity":
      return openaiLike({ url: "https://api.perplexity.ai/chat/completions", apiKey, model, prompt });
    case "anthropic":
      return anthropic({ apiKey, model, prompt });
    case "gemini":
      return gemini({ apiKey, model, prompt });
  }
}
