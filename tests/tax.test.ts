import { describe, expect, it } from "vitest";
import { RULES_2026, RULES_2026_ISA_REFORM, proposedItems } from "@/lib/tax/rules";
import { computeAnnualTax, compareIsa, computeTradeCost, DEFAULT_FEES } from "@/lib/tax/engine";
import { checkContribution, checkIsaEligibility, holdingStatus } from "@/lib/tax/isa";

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

  it("개편안 룰셋에서는 비과세 한도가 커져 절세액이 늘어난다", () => {
    const big = [{ kind: "kr_etf_other" as const, amount: 6_000_000 }];
    const now = compareIsa({ year: 2026, rules: RULES_2026, realized: big });
    const reform = compareIsa({ year: 2026, rules: RULES_2026_ISA_REFORM, realized: big });
    expect(reform.isa.totalTax).toBeLessThan(now.isa.totalTax);
    expect(reform.saved).toBeGreaterThan(now.saved);
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

  it("개편안에서는 연 4,000만원까지 들어간다", () => {
    const c = checkContribution({ rules: RULES_2026_ISA_REFORM, ledger: {}, openedYear: 2026, year: 2026, amount: 40_000_000 });
    expect(c.ok).toBe(true);
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
  it("현행 룰셋에는 미확정 ISA 항목이 없다", () => {
    const items = proposedItems(RULES_2026).filter((s) => s.startsWith("isa."));
    expect(items).toHaveLength(0);
  });

  it("개편안 룰셋은 미확정 항목을 노출한다", () => {
    const items = proposedItems(RULES_2026_ISA_REFORM).filter((s) => s.startsWith("isa."));
    expect(items.length).toBeGreaterThan(0);
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
