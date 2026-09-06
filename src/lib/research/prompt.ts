export interface PromptContext {
  name: string;
  symbol: string;
  kindLabel: string;
  taxHint: string;
  priceText: string;
  changeText: string;
  asOfText: string;
  marketLabel: string;
  /** 사용자가 이미 들고 있으면 그 상황도 알려준다 */
  holdingText: string | null;
  today: string;
}

/**
 * 리서치 프롬프트.
 *
 * 의도적으로 "사라/팔라"를 못 하게 막았다. 확정 신호를 받으면 사용자가
 * 근거를 안 보게 되고, 틀렸을 때 걸러낼 방법이 없어진다. 대신
 * 강세·약세 논거를 같은 무게로 요구하고, 모르는 것을 모른다고 적게 한다.
 */
export function buildPrompt(ctx: PromptContext): string {
  return `당신은 개인 투자자를 돕는 리서치 애널리스트입니다. 투자 권유가 아니라 "판단에 필요한 재료"를 정리하는 것이 역할입니다.

# 분석 대상
- 종목: ${ctx.name} (${ctx.symbol})
- 자산 구분: ${ctx.kindLabel}
- 한국 세금: ${ctx.taxHint}
- 현재가: ${ctx.priceText} (${ctx.changeText})
- 시세 기준 시각: ${ctx.asOfText} / ${ctx.marketLabel}
${ctx.holdingText ? `- 사용자 보유 상황: ${ctx.holdingText}` : "- 사용자는 아직 이 종목을 보유하지 않았습니다."}
- 오늘 날짜: ${ctx.today}

# 반드시 지킬 것
1. "매수하세요", "지금 사세요", "전량 매도" 같은 지시를 하지 마십시오. 대신 어떤 조건에서 어떤 판단이 가능한지를 씁니다.
2. 강세 논거와 약세 논거를 **같은 비중으로** 쓰십시오. 한쪽만 쓰면 실패한 답변입니다.
3. 모든 주장에는 근거를 답니다. 근거가 기억에 의존한 것이면 그렇게 밝히십시오.
4. 확인하지 못한 것은 unknowns에 솔직히 적으십시오. 모르는 것을 아는 척하지 마십시오.
5. 목표가·손절가를 단정하지 마십시오. 쓰려면 반드시 "어떤 가정 아래에서"인지 함께 적습니다.
6. 한국어로 씁니다. 수치는 단위를 붙입니다.

# 출력 형식
다른 말 없이 아래 JSON만 출력하십시오. 코드블록 표시도 붙이지 마십시오.

{
  "summary": "이 종목의 현재 상황을 3~4문장으로. 결론을 강요하지 말 것.",
  "bull": [{"point": "강세 논거", "evidence": "근거와 출처. 불확실하면 '미확인'이라고 명시"}],
  "bear": [{"point": "약세 논거", "evidence": "근거와 출처"}],
  "scenarios": [{"condition": "어떤 일이 일어나면", "implication": "그때 무엇을 의미하는지"}],
  "watchItems": ["앞으로 확인해야 할 지표·일정·발표"],
  "unknowns": ["이 분석에서 확인하지 못한 것"],
  "confidence": 0에서 100 사이 정수. 근거의 확실성이지 상승 확률이 아님,
  "sources": ["참고한 출처 URL 또는 자료명"]
}

bull과 bear는 각각 최소 3개, scenarios는 최소 2개를 채우십시오.`;
}

/** 모델들이 무엇에서 갈렸는지 뽑는다 — 합의를 강제하지 않는 대신 차이를 드러낸다 */
export function findDisagreements(
  results: { provider: string; confidence: number; bullCount: number; bearCount: number }[],
): string[] {
  if (results.length < 2) return [];
  const out: string[] = [];

  const conf = results.map((r) => r.confidence);
  const spread = Math.max(...conf) - Math.min(...conf);
  if (spread >= 25) {
    const hi = results.find((r) => r.confidence === Math.max(...conf))!;
    const lo = results.find((r) => r.confidence === Math.min(...conf))!;
    out.push(
      `근거의 확실성 평가가 갈립니다 — ${hi.provider} ${hi.confidence}점, ${lo.provider} ${lo.confidence}점. 확신이 낮은 쪽이 무엇을 걸리게 봤는지 먼저 읽어보세요.`,
    );
  }

  const leaning = results.map((r) => ({
    provider: r.provider,
    tilt: r.bullCount - r.bearCount,
  }));
  const bullish = leaning.filter((l) => l.tilt > 0).map((l) => l.provider);
  const bearish = leaning.filter((l) => l.tilt < 0).map((l) => l.provider);
  if (bullish.length > 0 && bearish.length > 0) {
    out.push(
      `논거의 무게가 반대로 실렸습니다 — ${bullish.join(", ")}은 강세 쪽, ${bearish.join(", ")}은 약세 쪽에 근거를 더 많이 붙였습니다.`,
    );
  }

  return out;
}
