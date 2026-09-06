export type ProviderId = "openai" | "anthropic" | "gemini" | "perplexity";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** 키 발급 페이지 */
  keyUrl: string;
  /** 가격표 — 모델마다 요금이 달라서, 고르기 전에 여기서 확인한다 */
  pricingUrl: string;
  /** 키 형태 힌트 — 붙여넣기 전에 맞는 키인지 알아볼 수 있게 */
  keyHint: string;
  defaultModel: string;
  /** 모델이 스스로 웹을 찾아볼 수 있는지 */
  webSearch: boolean;
  /** 모델 목록을 API로 받아올 수 있는지. 없으면 코드에 든 후보를 쓴다 */
  listable: boolean;
  note: string;
  /** 지금 알고 있는 주의사항 — 폐기 예정 같은 것 */
  warning?: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "perplexity",
    label: "Perplexity",
    keyUrl: "https://www.perplexity.ai/settings/api",
    pricingUrl: "https://docs.perplexity.ai/getting-started/pricing",
    keyHint: "pplx-…",
    defaultModel: "sonar-reasoning-pro",
    webSearch: true,
    listable: false,
    note: "최신 뉴스·시세를 직접 검색해 출처와 함께 답합니다. 넷 중 하나만 쓴다면 이걸 권합니다.",
    warning:
      "목록 API가 없어 코드에 적힌 후보입니다 (2026-09-06 확인). Perplexity는 chat/completions를 Agent API로 옮기는 중이라 모델 이름이 바뀔 수 있습니다 — 오류가 나면 공식 문서에서 확인해 직접 입력하세요.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    keyUrl: "https://aistudio.google.com/app/apikey",
    pricingUrl: "https://ai.google.dev/gemini-api/docs/pricing",
    keyHint: "AIza…",
    defaultModel: "gemini-3-pro",
    webSearch: false,
    listable: true,
    note: "무료 한도가 넉넉해서 가볍게 시작하기 좋습니다. flash가 pro보다 싸고 빠릅니다.",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    pricingUrl: "https://platform.openai.com/docs/pricing",
    keyHint: "sk-…",
    defaultModel: "gpt-5.4",
    webSearch: false,
    listable: true,
    note: "이름에 mini·nano가 붙은 모델이 더 싸고 빠릅니다.",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    keyUrl: "https://console.anthropic.com/settings/keys",
    pricingUrl: "https://www.anthropic.com/pricing#api",
    keyHint: "sk-ant-…",
    defaultModel: "claude-opus-5",
    webSearch: false,
    listable: true,
    note: "haiku가 가장 싸고, sonnet이 중간, opus가 가장 비쌉니다.",
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
