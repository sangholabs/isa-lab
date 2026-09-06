export type ProviderId = "openai" | "anthropic" | "gemini" | "perplexity";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** 키 발급 페이지 */
  keyUrl: string;
  /** 키 형태 힌트 — 붙여넣기 전에 맞는 키인지 알아볼 수 있게 */
  keyHint: string;
  defaultModel: string;
  /** 모델이 스스로 웹을 찾아볼 수 있는지 */
  webSearch: boolean;
  note: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "perplexity",
    label: "Perplexity",
    keyUrl: "https://www.perplexity.ai/settings/api",
    keyHint: "pplx-…",
    defaultModel: "sonar-reasoning-pro",
    webSearch: true,
    note: "최신 뉴스·시세를 직접 검색해 출처와 함께 답합니다. 넷 중 하나만 쓴다면 이걸 권합니다.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyHint: "AIza…",
    defaultModel: "gemini-3-pro",
    webSearch: false,
    note: "무료 한도가 넉넉해서 가볍게 시작하기 좋습니다.",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-…",
    defaultModel: "gpt-5.4",
    webSearch: false,
    note: "",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "sk-ant-…",
    defaultModel: "claude-opus-5",
    webSearch: false,
    note: "",
  },
];

export const PROVIDER_MAP = new Map(PROVIDERS.map((p) => [p.id, p]));

export interface Claim {
  point: string;
  evidence: string;
}

export interface Scenario {
  condition: string;
  implication: string;
}

/** 모델 하나가 돌려주는 리서치 결과 */
export interface Analysis {
  summary: string;
  bull: Claim[];
  bear: Claim[];
  scenarios: Scenario[];
  watchItems: string[];
  unknowns: string[];
  confidence: number;
  sources: string[];
}

export interface ProviderResult {
  provider: ProviderId;
  model: string;
  ok: boolean;
  analysis?: Analysis;
  /** 실패했을 때 API가 준 메시지를 그대로 — 모델 ID 오타 같은 걸 바로 알 수 있게 */
  error?: string;
  elapsedMs: number;
}

export interface ResearchResponse {
  asset: { id: string; name: string; symbol: string; kind: string };
  priceKrw: number | null;
  results: ProviderResult[];
  disagreements: string[];
  requestedAt: string;
}

export const RESEARCH_DISCLAIMER =
  "이 결과는 사용자가 넣은 API 키로 외부 LLM을 호출해 받은 것입니다. 사실 확인이 되지 않은 내용이 섞일 수 있고, 투자자문이 아닙니다. 매수·매도 판단과 그 결과는 전적으로 본인 책임입니다.";
