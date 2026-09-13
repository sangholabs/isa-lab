import { describe, expect, it } from "vitest";
import { RULES_2026, RULE_SETS, getRuleSet, proposedItems } from "@isa-lab/tax-engine/rules";
import { computeAnnualTax, compareIsa, computeTradeCost, DEFAULT_FEES } from "@isa-lab/tax-engine/engine";
import { checkContribution, checkIsaEligibility, holdingStatus } from "@isa-lab/tax-engine/isa";
import { buildConsensus, scoreAnalysis } from "@/lib/research/score";
import { buildScenario } from "@/lib/research/scenario";

const R = RULES_2026;

describe("거래 비용", () => {
  it("코스피 주식 매도에는 0.20% 거래세가 붙는다", () => {
    const c = computeTradeCost({ kind: "kr_stock", side: "sell", notional: 10_000_000, krMarket: "KOSPI", rules: R });
    expect(c.transactionTax).toBe(20_000);
    expect(c.brokerFee).toBeCloseTo(1_500, 6);
  });

  it("매수에는 거래세가 붙지 않는다", () => {
    const c = computeTradeCost({ kind: "kr_stock", side: "buy", notional: 10_000_000, rules: R });
    expect(c.transactionTax).toBe(0);
  });

  it("ETF는 매도해도 증권거래세가 없다", () => {
    for (const kind of ["kr_etf_equity", "kr_etf_other"] as const) {
      const c = computeTradeCost({ kind, side: "sell", notional: 10_000_000, rules: R });
      expect(c.transactionTax).toBe(0);
    }
  });

  it("해외주식에는 환전 스프레드가 붙는다", () => {
    const c = computeTradeCost({ kind: "overseas_stock", side: "buy", notional: 1_000_000, rules: R });
    expect(c.fxSpread).toBeCloseTo(1_000, 6);
    expect(c.total).toBeCloseTo(1_000 + 700, 6);
  });

  it("업비트 수수료는 0.05%", () => {
    const c = computeTradeCost({ kind: "crypto", side: "buy", notional: 1_000_000, rules: R });
    expect(c.total).toBeCloseTo(500, 6);
    expect(DEFAULT_FEES.cryptoFeeRate).toBe(0.0005);
  });
});

describe("일반계좌 연간 정산", () => {
  it("국내주식 매매차익은 비과세", () => {
    const r = computeAnnualTax({ account: "regular", year: 2026, rules: R, realized: [{ kind: "kr_stock", amount: 50_000_000 }] });
    expect(r.totalTax).toBe(0);
  });

  it("국내상장 해외ETF는 손실과 통산되지 않는다 — 이익분에만 15.4%", () => {
    const r = computeAnnualTax({
      account: "regular",
      year: 2026,
      rules: R,
      realized: [
        { kind: "kr_etf_other", amount: 10_000_000 },
        { kind: "kr_etf_other", amount: -8_000_000 },
      ],
    });
    // 통산이 됐다면 200만 × 15.4% = 308,000원이어야 하지만, 실제로는 1,000만 전액에 붙는다
    expect(r.totalTax).toBeCloseTo(1_540_000, 6);
  });

  it("해외주식은 통산 후 250만원을 공제한다", () => {
    const r = computeAnnualTax({
      account: "regular",
      year: 2026,
      rules: R,
      realized: [
        { kind: "overseas_stock", amount: 10_000_000 },
        { kind: "overseas_stock", amount: -3_000_000 },
      ],
    });
    // (700만 − 250만) × 22%
    expect(r.totalTax).toBeCloseTo(990_000, 6);
  });

  it("해외주식 순손실이면 세금은 0", () => {
    const r = computeAnnualTax({ account: "regular", year: 2026, rules: R, realized: [{ kind: "overseas_stock", amount: -5_000_000 }] });
    expect(r.totalTax).toBe(0);
  });

  it("가상자산은 2026년에는 과세하지 않는다", () => {
    const r = computeAnnualTax({ account: "regular", year: 2026, rules: R, realized: [{ kind: "crypto", amount: 100_000_000 }] });
    expect(r.totalTax).toBe(0);
  });

  it("가상자산은 2027년부터 250만원 공제 후 22%", () => {
    const r = computeAnnualTax({ account: "regular", year: 2027, rules: R, realized: [{ kind: "crypto", amount: 10_000_000 }] });
    expect(r.totalTax).toBeCloseTo((10_000_000 - 2_500_000) * 0.22, 6);
  });
});

describe("ISA 정산", () => {
  const realized = [
    { kind: "kr_etf_other" as const, amount: 10_000_000 },
    { kind: "kr_etf_other" as const, amount: -8_000_000 },
  ];

  it("계좌 안에서 손익을 통산한다", () => {
    const r = computeAnnualTax({ account: "isa_general", year: 2026, rules: R, realized });
    // 통산 순이익 200만 ≤ 비과세 한도 200만 → 세금 0
    expect(r.totalTax).toBe(0);
  });

  it("비과세 한도를 넘으면 초과분에만 9.9%", () => {
    const r = computeAnnualTax({
      account: "isa_general",
      year: 2026,
      rules: R,
      realized: [{ kind: "kr_etf_other", amount: 5_000_000 }],
    });
    expect(r.totalTax).toBeCloseTo((5_000_000 - 2_000_000) * 0.099, 6);
  });

  it("서민형은 비과세 한도가 400만원", () => {
    const r = computeAnnualTax({
      account: "isa_low_income",
      year: 2026,
      rules: R,
      realized: [{ kind: "kr_etf_other", amount: 5_000_000 }],
    });
    expect(r.totalTax).toBeCloseTo((5_000_000 - 4_000_000) * 0.099, 6);
  });

  it("의무보유기간을 못 채우면 일반계좌와 똑같이 과세된다", () => {
    const r = computeAnnualTax({ account: "isa_general", year: 2026, rules: R, realized, isaHoldingSatisfied: false });
    expect(r.totalTax).toBeCloseTo(1_540_000, 6);
    expect(r.assumptions.join(" ")).toContain("의무보유기간");
  });

  it("일반계좌 대비 절세액을 계산한다", () => {
    const c = compareIsa({ year: 2026, rules: R, realized });
    expect(c.regular.totalTax).toBeCloseTo(1_540_000, 6);
    expect(c.isa.totalTax).toBe(0);
    expect(c.saved).toBeCloseTo(1_540_000, 6);
  });

  it("국내 상장주식 매매손실은 ISA 순이익에서 뺀다 (조특령 제93조의4⑨)", () => {
    const r = computeAnnualTax({
      account: "isa_general",
      year: 2026,
      rules: R,
      realized: [
        { kind: "kr_etf_other", amount: 10_000_000 },
        { kind: "kr_stock", amount: -5_000_000 },
      ],
    });
    // 1,000만 − 500만 = 500만 → 비과세 200만 초과분 300만 × 9.9%
    expect(r.totalTax).toBeCloseTo(3_000_000 * 0.099, 6);
  });

  it("국내 상장주식 매매이익은 ISA 순이익에 더하지 않는다 — 이자·배당소득이 아니다", () => {
    const r = computeAnnualTax({
      account: "isa_general",
      year: 2026,
      rules: R,
      realized: [
        { kind: "kr_etf_other", amount: 5_000_000 },
        { kind: "kr_stock", amount: 9_000_000 },
      ],
    });
    expect(r.totalTax).toBeCloseTo((5_000_000 - 2_000_000) * 0.099, 6);
  });

  it("경계: 국내주식은 이익·손실을 먼저 합쳐 남은 순손실만 뺀다", () => {
    const r = computeAnnualTax({
      account: "isa_general",
      year: 2026,
      rules: R,
      realized: [
        { kind: "kr_etf_other", amount: 6_000_000 },
        { kind: "kr_stock", amount: 3_000_000 },
        { kind: "kr_stock", amount: -4_000_000 },
      ],
    });
    // 국내주식 순손실 100만 → 600만 − 100만 = 500만 → 초과분 300만 × 9.9%
    expect(r.totalTax).toBeCloseTo(3_000_000 * 0.099, 6);
  });

  it("국내주식형 ETF 손실은 ISA 순이익에서 빼지 않는다 (조특령 제93조의4⑨2호)", () => {
    const r = computeAnnualTax({
      account: "isa_general",
      year: 2026,
      rules: R,
      realized: [
        { kind: "kr_etf_other", amount: 5_000_000 },
        { kind: "kr_etf_equity", amount: -5_000_000 },
      ],
    });
    expect(r.totalTax).toBeCloseTo((5_000_000 - 2_000_000) * 0.099, 6);
  });

  it("국내주식 손실 차감은 일반계좌 세금을 바꾸지 않고 절세액만 키운다", () => {
    const realizedWithLoss = [
      { kind: "kr_etf_other" as const, amount: 10_000_000 },
      { kind: "kr_stock" as const, amount: -5_000_000 },
    ];
    const c = compareIsa({ year: 2026, rules: R, realized: realizedWithLoss });
    expect(c.regular.totalTax).toBeCloseTo(1_540_000, 6);
    expect(c.saved).toBeCloseTo(1_540_000 - 3_000_000 * 0.099, 6);
  });

  it("경계: 국내주식 손실이 국내주식형 ETF 이익과 합쳐 0이 돼도 손실 차감을 설명한다 (금액은 원 단위 반올림)", () => {
    const r = computeAnnualTax({
      account: "isa_general",
      year: 2026,
      rules: R,
      realized: [
        { kind: "kr_etf_other", amount: 5_000_000 },
        { kind: "kr_stock", amount: -3_000_000.4 },
        { kind: "kr_etf_equity", amount: 3_000_000.4 },
      ],
    });
    expect(r.lines.some((l) => l.note.includes("3,000,000원"))).toBe(true);
    expect(r.totalTax).toBe(0); // 500만 − 300만 = 200만 ≤ 비과세 한도 200만
  });

  it("ISA는 해지할 때 계좌 전체를 한 번 정산한다는 가정을 밝힌다 (조특법 제91조의18⑤)", () => {
    const r = computeAnnualTax({ account: "isa_general", year: 2026, rules: R, realized });
    expect(r.assumptions.join(" ")).toContain("해지");
  });
});

describe("ISA 납입한도", () => {
  it("연 한도를 넘으면 넣을 수 있는 만큼만 알려준다", () => {
    const c = checkContribution({ rules: R, ledger: {}, openedYear: 2026, year: 2026, amount: 30_000_000 });
    expect(c.ok).toBe(false);
    expect(c.allowed).toBe(20_000_000);
  });

  it("쓰지 않은 한도는 다음 해로 이월된다", () => {
    const c = checkContribution({ rules: R, ledger: { 2026: 0 }, openedYear: 2026, year: 2027, amount: 40_000_000 });
    expect(c.ok).toBe(true);
    expect(c.allowed).toBe(40_000_000);
  });

  it("총 한도를 다 쓰면 더 넣을 수 없다", () => {
    const ledger = { 2026: 20_000_000, 2027: 20_000_000, 2028: 20_000_000, 2029: 20_000_000, 2030: 20_000_000 };
    const c = checkContribution({ rules: R, ledger, openedYear: 2026, year: 2031, amount: 1_000_000 });
    expect(c.ok).toBe(false);
    expect(c.remainingTotal).toBe(0);
  });

});

describe("ISA 편입 제한", () => {
  it("해외주식 직접투자는 막는다", () => {
    const e = checkIsaEligibility("overseas_stock");
    expect(e.ok).toBe(false);
    expect(e.reason).toContain("국내상장 해외ETF");
  });

  it("코인도 막는다", () => {
    expect(checkIsaEligibility("crypto").ok).toBe(false);
  });

  it("국내상장 상품은 담을 수 있다", () => {
    for (const k of ["kr_stock", "kr_etf_equity", "kr_etf_other"] as const) {
      expect(checkIsaEligibility(k).ok).toBe(true);
    }
  });
});

describe("의무보유기간", () => {
  it("3년을 채우면 satisfied", () => {
    const s = holdingStatus({ rules: R, openedAt: new Date("2023-01-01"), now: new Date("2026-01-01") });
    expect(s.satisfied).toBe(true);
    expect(s.monthsLeft).toBe(0);
  });

  it("아직이면 남은 개월 수를 알려준다", () => {
    const s = holdingStatus({ rules: R, openedAt: new Date("2025-01-01"), now: new Date("2026-01-01") });
    expect(s.satisfied).toBe(false);
    expect(s.monthsLeft).toBe(24);
  });
});

describe("룰셋 메타데이터", () => {
  it("현행 룰셋에 확정 전 항목이 없다 — 가상자산 공제·세율도 입법돼 2027년 시행", () => {
    expect(proposedItems(RULES_2026)).toEqual([]);
    expect(RULES_2026.cryptoTaxStartYear.value).toBe(2027);
    expect(RULES_2026.cryptoDeduction.status).toBe("enacted");
    expect(RULES_2026.cryptoTaxRate.status).toBe("enacted");
  });

  it("입법되지 않은 2024년 ISA 개편안 룰셋은 없다 — 예전 id로 저장된 값은 현행으로 돌아간다", () => {
    expect(RULE_SETS.map((r) => r.id)).toEqual(["kr-2026"]);
    expect(getRuleSet("kr-2026-isa-reform")).toBe(RULES_2026);
  });
});

describe("ISA 비교에서 담을 수 없는 자산 제외", () => {
  it("해외주식·코인은 비교에서 빠지고 어떤 자산군이 빠졌는지 알려준다", () => {
    const c = compareIsa({
      year: 2027,
      rules: R,
      realized: [
        { kind: "kr_etf_other", amount: 5_000_000 },
        { kind: "overseas_stock", amount: 50_000_000 },
        { kind: "crypto", amount: 30_000_000 },
      ],
    });
    expect(c.excludedKinds).toEqual(["overseas_stock", "crypto"]);
    // 해외주식·코인이 빠졌으므로 ETF 500만원만 놓고 계산된다
    expect(c.regular.totalTax).toBeCloseTo(5_000_000 * 0.154, 6);
    expect(c.isa.totalTax).toBeCloseTo((5_000_000 - 2_000_000) * 0.099, 6);
  });
});

describe("리서치 신뢰도 점수", () => {
  const base = {
    summary: "요약",
    bull: [{ point: "a", evidence: "출처 있는 근거입니다" }, { point: "b", evidence: "또 다른 근거입니다" }],
    bear: [{ point: "c", evidence: "반대 근거입니다" }, { point: "d", evidence: "또 다른 반대 근거" }],
    scenarios: [],
    watchItems: [],
    unknowns: ["확인 못 한 것 1", "확인 못 한 것 2"],
    confidence: 70,
    sources: ["https://example.com/a", "https://example.com/b", "https://example.com/c"],
  };

  it("근거·출처·균형이 다 갖춰지면 높게 나온다", () => {
    const s = scoreAnalysis(base);
    expect(s.total).toBeGreaterThanOrEqual(70);
    expect(s.grade).toBe("높음");
    expect(s.caution).toBeNull();
  });

  it("출처가 없으면 감점하고 경고한다", () => {
    const s = scoreAnalysis({ ...base, sources: [] });
    expect(s.items.find((i) => i.key === "sources")!.earned).toBe(0);
    expect(s.caution).toContain("출처가 하나도 없습니다");
  });

  it("한쪽 논거만 있으면 균형 점수가 0이고 경고한다", () => {
    const s = scoreAnalysis({ ...base, bear: [] });
    expect(s.items.find((i) => i.key === "balance")!.earned).toBe(0);
    expect(s.caution).toContain("한쪽 논거만");
  });

  it("근거 없는 주장만 있으면 근거 점수가 0이다", () => {
    const s = scoreAnalysis({
      ...base,
      bull: [{ point: "a", evidence: "" }],
      bear: [{ point: "b", evidence: "" }],
    });
    expect(s.items.find((i) => i.key === "evidence")!.earned).toBe(0);
  });

  it("모델이 하나면 합의를 말하지 않는다", () => {
    const c = buildConsensus(
      [{ provider: "perplexity", model: "m", ok: true, analysis: base, elapsedMs: 1 }],
      () => "Perplexity",
    );
    expect(c.agreement).toBeNull();
    expect(c.summary).toContain("교차 검증");
  });

  it("방향이 갈리면 갈렸다고 말한다", () => {
    const bull = { ...base, bull: [...base.bull, { point: "e", evidence: "f" }, { point: "g", evidence: "h" }], bear: [] };
    const bear = { ...base, bull: [], bear: [...base.bear, { point: "e", evidence: "f" }, { point: "g", evidence: "h" }] };
    const c = buildConsensus(
      [
        { provider: "perplexity", model: "m", ok: true, analysis: bull, elapsedMs: 1 },
        { provider: "gemini", model: "m", ok: true, analysis: bear, elapsedMs: 1 },
      ],
      (id) => id,
    );
    expect(c.bullish).toBe(1);
    expect(c.bearish).toBe(1);
    expect(c.summary).toContain("갈렸다는 건");
  });
});

describe("세후 시나리오", () => {
  it("국내상장 해외ETF는 오를수록 ISA 절세액이 커진다", () => {
    const sc = buildScenario({
      kind: "kr_etf_other",
      investKrw: 10_000_000,
      rules: R,
      fees: DEFAULT_FEES,
      year: 2026,
    });
    const up10 = sc.rows.find((r) => r.changePct === 10)!;
    const up30 = sc.rows.find((r) => r.changePct === 30)!;
    expect(up10.savedKrw!).toBeGreaterThan(0);
    expect(up30.savedKrw!).toBeGreaterThan(up10.savedKrw!);
    expect(up30.isaNetKrw!).toBeGreaterThan(up30.regularNetKrw);
  });

  it("해외주식은 ISA에 못 담으므로 ISA 열이 비어 있다", () => {
    const sc = buildScenario({
      kind: "overseas_stock",
      investKrw: 10_000_000,
      rules: R,
      fees: DEFAULT_FEES,
      year: 2026,
    });
    expect(sc.isaEligible).toBe(false);
    expect(sc.rows.every((r) => r.isaNetKrw === null)).toBe(true);
  });

  it("국내주식은 매매차익이 비과세라 세금이 0이다", () => {
    const sc = buildScenario({
      kind: "kr_stock",
      krMarket: "KOSPI",
      investKrw: 10_000_000,
      rules: R,
      fees: DEFAULT_FEES,
      year: 2026,
    });
    expect(sc.rows.every((r) => r.regularTaxKrw === 0)).toBe(true);
    // 대신 매도 거래세가 세전 손익에서 이미 빠져 있다
    const up10 = sc.rows.find((r) => r.changePct === 10)!;
    expect(up10.grossKrw).toBeLessThan(1_000_000);
  });

  it("떨어지면 세금이 붙지 않는다", () => {
    const sc = buildScenario({
      kind: "kr_etf_other",
      investKrw: 10_000_000,
      rules: R,
      fees: DEFAULT_FEES,
      year: 2026,
    });
    const down = sc.rows.find((r) => r.changePct === -20)!;
    expect(down.grossKrw).toBeLessThan(0);
    expect(down.regularTaxKrw).toBe(0);
  });
});
