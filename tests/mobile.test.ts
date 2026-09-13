import { describe, expect, it } from "vitest";
import { compute, toRealized } from "../apps/mobile/src/compute";
import { manwonToWon, pct, won } from "../apps/mobile/src/format";
import { DEMO_ENTRIES, initialState, restore, type AppState } from "../apps/mobile/src/state";

const withEntries = (entries: Partial<AppState["entries"]>): AppState => ({ ...initialState, entries: { ...initialState.entries, ...entries } });
const DEMO = withEntries(DEMO_ENTRIES);

describe("덜내 앱 — 입력을 엔진 입력으로", () => {
  it("만원 문자열 → 원. 빈칸·쉼표·쓰레기는 0", () => {
    expect(manwonToWon("150")).toBe(1_500_000);
    expect(manwonToWon("12.5")).toBe(125_000);
    expect(manwonToWon("1,000")).toBe(10_000_000);
    expect(manwonToWon("")).toBe(0);
    expect(manwonToWon("abc")).toBe(0);
  });

  it("이익과 손실은 합치지 않고 두 행으로 넘긴다 — 해외·채권 ETF는 통산이 안 되기 때문 (ADR-0004)", () => {
    const rows = toRealized(DEMO);
    expect(rows).toContainEqual({ kind: "kr_etf_other", amount: 10_000_000 });
    expect(rows).toContainEqual({ kind: "kr_etf_other", amount: -8_000_000 });
    expect(rows.filter((r) => r.kind === "kr_stock")).toEqual([{ kind: "kr_stock", amount: 1_500_000 }]);
  });

  it("예시: 일반계좌 1,540,000원 vs ISA 0원", () => {
    const o = compute(DEMO);
    expect(o.comparison.regular.totalTax).toBeCloseTo(1_540_000, 6);
    expect(o.comparison.isa.totalTax).toBe(0);
    expect(o.comparison.saved).toBeCloseTo(1_540_000, 6);
    expect(o.outsideIsa).toBeNull();
  });

  it("경계: 이익 = 손실이어도 해외·채권 ETF 이익에는 일반계좌 세금이 붙는다", () => {
    const o = compute(withEntries({ kr_etf_other: { profit: "800", loss: "800" } }));
    expect(o.realized).toHaveLength(2);
    expect(o.comparison.regular.totalTax).toBeCloseTo(1_232_000, 6);
    expect(o.comparison.isa.totalTax).toBe(0);
  });

  it("해외주식·코인은 비교에서 빠지고 따로 계산된다", () => {
    const o = compute(withEntries({ overseas_stock: { profit: "500", loss: "" }, crypto: { profit: "100", loss: "" } }));
    expect(o.comparison.excludedKinds.sort()).toEqual(["crypto", "overseas_stock"]);
    expect(o.comparison.saved).toBe(0);
    // 해외주식 500만 − 공제 250만 = 250만 × 22% = 55만 · 코인은 2026년 비과세
    expect(o.outsideIsa?.totalTax).toBeCloseTo(550_000, 6);
  });

  it("아무것도 안 넣으면 세금 0, 항목 없음", () => {
    const o = compute(initialState);
    expect(o.realized).toEqual([]);
    expect(o.comparison.saved).toBe(0);
    expect(o.outsideIsa).toBeNull();
  });

  it("표기: 원·%", () => {
    expect(won(1_540_000)).toBe("1,540,000원");
    expect(won(-2_500)).toBe("-2,500원");
    expect(pct(0.154)).toBe("15.4%");
    expect(pct(0.22)).toBe("22%");
  });
});

describe("덜내 앱 — 기기 저장본 복원", () => {
  it("저장본이 없거나 깨졌으면 기본값으로 연다", () => {
    expect(restore(null)).toEqual(initialState);
    expect(restore("{not json")).toEqual(initialState);
    expect(restore("123")).toEqual(initialState);
  });

  it("저장한 입력·설정이 그대로 돌아온다", () => {
    const saved: AppState = { ...initialState, entries: DEMO_ENTRIES, year: 2027, isaType: "isa_low_income", holdingSatisfied: false };
    expect(restore(JSON.stringify(saved))).toEqual(saved);
  });

  it("모양이 어긋난 저장본: 빠진 자산군은 빈칸, 없어진 룰셋은 기본 룰셋", () => {
    const r = restore(JSON.stringify({ entries: { kr_stock: { profit: "1", loss: "" } }, ruleSetId: "gone" }));
    expect(r.entries.kr_stock.profit).toBe("1");
    expect(r.entries.crypto).toEqual({ profit: "", loss: "" });
    expect(r.ruleSetId).toBe(initialState.ruleSetId);
  });
});
