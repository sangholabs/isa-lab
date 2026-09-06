import type { Analysis, ProviderResult } from "./types";

/**
 * 리서치 신뢰도 점수.
 *
 * ⚠️ 이 점수는 "이 종목이 좋다"가 아니다. **이 분석을 얼마나 믿을 수 있는지**다.
 *
 * 매수 점수를 매기면 사람은 점수만 보고 근거를 안 읽는다. 그러면 모델이
 * 틀렸을 때 걸러낼 방법이 없어진다. 그래서 채점 대상을 종목이 아니라
 * 분석의 품질로 뒤집었다 — 근거를 달았는가, 출처가 있는가, 양쪽을 봤는가,
 * 모르는 걸 모른다고 했는가.
 */

export interface ScoreItem {
  key: string;
  label: string;
  earned: number;
  max: number;
  detail: string;
}

export interface QualityScore {
  total: number;
  items: ScoreItem[];
  grade: "높음" | "보통" | "낮음";
  caution: string | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function scoreAnalysis(a: Analysis): QualityScore {
  const claims = [...a.bull, ...a.bear];
  const withEvidence = claims.filter((c) => c.evidence.trim().length >= 10).length;

  // 1) 근거 충실도 — 주장에 근거가 붙어 있는 비율
  const evidenceRatio = claims.length === 0 ? 0 : withEvidence / claims.length;
  const evidence: ScoreItem = {
    key: "evidence",
    label: "근거 충실도",
    earned: Math.round(evidenceRatio * 30),
    max: 30,
    detail:
      claims.length === 0
        ? "논거가 없습니다"
        : `${claims.length}개 주장 중 ${withEvidence}개에 근거가 붙었습니다`,
  };

  // 2) 출처 — 검증할 수 있는 링크가 있는가
  const linked = a.sources.filter((s) => /^https?:\/\//.test(s)).length;
  const sourceScore = clamp(linked * 7 + (a.sources.length - linked) * 3, 0, 20);
  const sources: ScoreItem = {
    key: "sources",
    label: "출처",
    earned: Math.round(sourceScore),
    max: 20,
    detail:
      a.sources.length === 0
        ? "출처가 없습니다 — 모델의 기억에만 의존한 답일 수 있습니다"
        : `${a.sources.length}건 (링크 ${linked}건)`,
  };

  // 3) 논거 균형 — 한쪽만 쓴 답은 재료가 아니라 주장이다
  const n = a.bull.length + a.bear.length;
  const balance = n === 0 ? 0 : 1 - Math.abs(a.bull.length - a.bear.length) / n;
  const balanceItem: ScoreItem = {
    key: "balance",
    label: "논거 균형",
    earned: Math.round(balance * 20),
    max: 20,
    detail: `강세 ${a.bull.length} · 약세 ${a.bear.length}`,
  };

  // 4) 불확실성 인정 — 모르는 걸 모른다고 적었는가
  const unknownScore = clamp(a.unknowns.length * 5, 0, 15);
  const unknowns: ScoreItem = {
    key: "unknowns",
    label: "불확실성 인정",
    earned: unknownScore,
    max: 15,
    detail:
      a.unknowns.length === 0
        ? "확인 못 한 것을 적지 않았습니다 — 정말 다 확인했는지 의심해 보세요"
        : `${a.unknowns.length}건을 확인하지 못했다고 밝혔습니다`,
  };

  // 5) 모델 자기평가
  const self: ScoreItem = {
    key: "self",
    label: "모델 자기평가",
    earned: Math.round((a.confidence / 100) * 15),
    max: 15,
    detail: `모델이 스스로 매긴 근거 확실성 ${a.confidence}점`,
  };

  const items = [evidence, sources, balanceItem, unknowns, self];
  const total = items.reduce((s, i) => s + i.earned, 0);

  let caution: string | null = null;
  if (a.sources.length === 0) {
    caution = "출처가 하나도 없습니다. 사실 확인 없이 그대로 믿지 마세요.";
  } else if (a.bull.length === 0 || a.bear.length === 0) {
    caution = "한쪽 논거만 나왔습니다. 반대편을 스스로 찾아봐야 합니다.";
  } else if (evidenceRatio < 0.5) {
    caution = "근거 없이 주장만 있는 항목이 절반을 넘습니다.";
  }

  return {
    total,
    items,
    grade: total >= 70 ? "높음" : total >= 45 ? "보통" : "낮음",
    caution,
  };
}

/* ------------------------------------------------------------------ */
/* 모델 간 합의                                                        */
/* ------------------------------------------------------------------ */

export type Tilt = "bullish" | "bearish" | "neutral";

export interface ModelStance {
  provider: string;
  label: string;
  tilt: Tilt;
  bull: number;
  bear: number;
  quality: number;
}

export interface Consensus {
  stances: ModelStance[];
  bullish: number;
  bearish: number;
  neutral: number;
  /** 0~100. 모델이 하나뿐이면 null — 혼자서는 합의를 말할 수 없다 */
  agreement: number | null;
  summary: string;
}

function tiltOf(a: Analysis): Tilt {
  const d = a.bull.length - a.bear.length;
  if (d >= 2) return "bullish";
  if (d <= -2) return "bearish";
  return "neutral";
}

export function buildConsensus(
  results: ProviderResult[],
  labelOf: (id: string) => string,
): Consensus {
  const ok = results.filter((r) => r.ok && r.analysis);
  const stances: ModelStance[] = ok.map((r) => ({
    provider: r.provider,
    label: labelOf(r.provider),
    tilt: tiltOf(r.analysis!),
    bull: r.analysis!.bull.length,
    bear: r.analysis!.bear.length,
    quality: scoreAnalysis(r.analysis!).total,
  }));

  const bullish = stances.filter((s) => s.tilt === "bullish").length;
  const bearish = stances.filter((s) => s.tilt === "bearish").length;
  const neutral = stances.filter((s) => s.tilt === "neutral").length;

  if (stances.length === 0) {
    return { stances, bullish, bearish, neutral, agreement: null, summary: "성공한 분석이 없습니다." };
  }
  if (stances.length === 1) {
    return {
      stances,
      bullish,
      bearish,
      neutral,
      agreement: null,
      summary:
        "모델이 하나뿐이라 교차 검증이 되지 않았습니다. 다른 모델을 하나 더 붙이면 이 분석이 그 모델만의 해석인지 알 수 있습니다.",
    };
  }

  const max = Math.max(bullish, bearish, neutral);
  const agreement = Math.round((max / stances.length) * 100);

  let summary: string;
  if (bullish > 0 && bearish > 0) {
    summary = `모델 ${stances.length}개 중 ${bullish}개는 강세 쪽, ${bearish}개는 약세 쪽에 논거를 더 실었습니다. 방향이 갈렸다는 건 지금 판단하기에 재료가 부족하다는 뜻입니다.`;
  } else if (max === stances.length && neutral === stances.length) {
    summary = `모델 ${stances.length}개 모두 어느 쪽으로도 크게 기울지 않았습니다.`;
  } else if (max === stances.length) {
    summary = `모델 ${stances.length}개가 같은 방향(${bullish > 0 ? "강세" : "약세"})으로 기울었습니다. 다만 같은 뉴스를 읽으면 같은 결론이 나오기 쉬우니, 합의가 곧 정답은 아닙니다.`;
  } else {
    summary = `강세 ${bullish} · 중립 ${neutral} · 약세 ${bearish}로 나뉘었습니다.`;
  }

  return { stances, bullish, bearish, neutral, agreement, summary };
}

/* ------------------------------------------------------------------ */
/* 판단 체크리스트                                                     */
/* ------------------------------------------------------------------ */

export interface CheckItem {
  question: string;
  why: string;
}

/**
 * 매수 전에 스스로 답해야 하는 질문.
 *
 * LLM이 만들지 않는다. 종목이 무엇이든 사람이 답해야 하는 것들이고,
 * 모델이 대신 답하면 의미가 없기 때문이다.
 */
export function decisionChecklist(params: {
  assetKindLabel: string;
  taxHint: string;
  hasBearArgument: boolean;
  sourceCount: number;
}): CheckItem[] {
  const items: CheckItem[] = [
    {
      question: "이 돈을 얼마 동안 안 써도 됩니까?",
      why: "기간이 짧으면 좋은 종목이어도 손실 구간에서 팔게 됩니다. 종목보다 기간이 먼저입니다.",
    },
    {
      question: "얼마나 떨어지면 «내 판단이 틀렸다»고 인정하겠습니까?",
      why: "사기 전에 정해두지 않으면, 떨어진 뒤에는 어떤 숫자도 «조금만 더»가 됩니다.",
    },
  ];

  if (params.hasBearArgument) {
    items.push({
      question: "약세 논거 중 가장 걸리는 하나는 무엇이고, 그게 현실이 되면 어떻게 하시겠습니까?",
      why: "반대 논거를 읽고도 대응을 안 정해두면 읽지 않은 것과 같습니다.",
    });
  } else {
    items.push({
      question: "반대편 근거를 직접 찾아보셨습니까?",
      why: "이번 분석에는 약세 논거가 나오지 않았습니다. 없는 게 아니라 모델이 못 찾은 것일 수 있습니다.",
    });
  }

  if (params.sourceCount === 0) {
    items.push({
      question: "이 분석의 사실관계를 직접 확인하셨습니까?",
      why: "출처가 하나도 없어서, 모델이 지어낸 내용이 섞여 있어도 알 수 없습니다.",
    });
  }

  items.push({
    question: `세금을 계산에 넣으셨습니까? (${params.assetKindLabel} — ${params.taxHint})`,
    why: "수익률은 세전이고, 손에 들어오는 건 세후입니다. 아래 시나리오에서 계좌별 차이를 볼 수 있습니다.",
  });

  return items;
}
