import { describe, expect, it } from "vitest";
import { RULES_2026 } from "@/lib/tax/rules";
import { buildHoldings, deposit, placeOrder } from "@/lib/portfolio/engine";
import { computeMetrics, financialIncomeWarning } from "@/lib/portfolio/metrics";
import { marketState } from "@/lib/market/marketState";
import type { Account, Asset, Trade } from "@/lib/portfolio/types";

const R = RULES_2026;

const acct = (over: Partial<Account> = {}): Account => ({
  id: "a1",
  name: "일반",
  type: "regular",
  cashKrw: 10_000_000,
  openedAt: "2026-01-01T00:00:00.000Z",
  contributions: {},
  ...over,
});

const samsung: Asset = {
  id: "kr:005930",
  kind: "kr_stock",
  symbol: "005930.KS",
  name: "삼성전자",
  currency: "KRW",
  krMarket: "KOSPI",
};

const aapl: Asset = { id: "us:AAPL", kind: "overseas_stock", symbol: "AAPL", name: "Apple", currency: "USD" };

describe("주문", () => {
  it("예수금이 모자라면 거부한다", () => {
    const r = placeOrder({ account: acct({ cashKrw: 100_000 }), asset: samsung, side: "buy", quantity: 10, price: 255_500, fxKrwPerUsd: null, rules: R }, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("예수금");
  });

  it("매수하면 대금과 수수료만큼 예수금이 준다", () => {
    const r = placeOrder({ account: acct(), asset: samsung, side: "buy", quantity: 10, price: 255_500, fxKrwPerUsd: null, rules: R }, []);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const notional = 2_555_000;
      expect(r.account.cashKrw).toBeCloseTo(10_000_000 - notional - notional * 0.00015, 4);
    }
  });

  it("보유하지 않은 종목은 못 판다", () => {
    const r = placeOrder({ account: acct(), asset: samsung, side: "sell", quantity: 1, price: 255_500, fxKrwPerUsd: null, rules: R }, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("보유 수량");
  });

  it("해외자산인데 환율이 없으면 주문을 받지 않는다", () => {
    const r = placeOrder({ account: acct(), asset: aapl, side: "buy", quantity: 1, price: 200, fxKrwPerUsd: null, rules: R }, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("환율");
  });

  it("ISA 계좌로는 해외주식을 못 산다", () => {
    const r = placeOrder({ account: acct({ type: "isa_general" }), asset: aapl, side: "buy", quantity: 1, price: 200, fxKrwPerUsd: 1350, rules: R }, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("국내상장 해외ETF");
  });

  it("매도 실현손익에서 매수·매도 비용이 모두 빠진다", () => {
    const buy = placeOrder({ account: acct(), asset: samsung, side: "buy", quantity: 10, price: 200_000, fxKrwPerUsd: null, rules: R }, []);
    expect(buy.ok).toBe(true);
    if (!buy.ok) return;
    const trades: Trade[] = [buy.trade];

    const sell = placeOrder({ account: buy.account, asset: samsung, side: "sell", quantity: 10, price: 220_000, fxKrwPerUsd: null, rules: R }, trades);
    expect(sell.ok).toBe(true);
    if (!sell.ok) return;

    const buyCost = 2_000_000 * 0.00015;
    const sellCost = 2_200_000 * (0.00015 + 0.002);
    expect(sell.trade.realizedKrw).toBeCloseTo(200_000 - buyCost - sellCost, 4);
  });

  it("여러 번 나눠 사면 평균단가로 합쳐진다", () => {
    let a = acct({ cashKrw: 100_000_000 });
    const trades: Trade[] = [];
    for (const p of [100_000, 200_000]) {
      const r = placeOrder({ account: a, asset: samsung, side: "buy", quantity: 10, price: p, fxKrwPerUsd: null, rules: R }, trades);
      expect(r.ok).toBe(true);
      if (r.ok) {
        trades.push(r.trade);
        a = r.account;
      }
    }
    const h = buildHoldings(trades, a.id).get(samsung.id)!;
    expect(h.quantity).toBe(20);
    // (100만 + 수수료 + 200만 + 수수료) / 20
    expect(h.avgCostKrw).toBeCloseTo((1_000_000 * 1.00015 + 2_000_000 * 1.00015) / 20, 4);
  });

  it("전량 매도하면 보유에서 사라진다", () => {
    const buy = placeOrder({ account: acct(), asset: samsung, side: "buy", quantity: 5, price: 200_000, fxKrwPerUsd: null, rules: R }, []);
    if (!buy.ok) throw new Error("buy failed");
    const sell = placeOrder({ account: buy.account, asset: samsung, side: "sell", quantity: 5, price: 210_000, fxKrwPerUsd: null, rules: R }, [buy.trade]);
    if (!sell.ok) throw new Error("sell failed");
    expect(buildHoldings([buy.trade, sell.trade], "a1").size).toBe(0);
  });
});

describe("입금", () => {
  it("일반계좌는 한도 없이 들어간다", () => {
    const r = deposit({ account: acct({ cashKrw: 0 }), amount: 500_000_000, rules: R, year: 2026 });
    expect(r.ok).toBe(true);
  });

  it("ISA는 연 한도를 넘으면 거부하고 가능한 금액을 알려준다", () => {
    const r = deposit({ account: acct({ type: "isa_general", cashKrw: 0 }), amount: 30_000_000, rules: R, year: 2026 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.allowed).toBe(20_000_000);
  });

  it("ISA 입금은 납입이력에 쌓인다", () => {
    const r = deposit({ account: acct({ type: "isa_general", cashKrw: 0 }), amount: 5_000_000, rules: R, year: 2026 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.account.contributions[2026]).toBe(5_000_000);
  });
});

describe("성과 지표", () => {
  it("세후 손익은 평가손익 + 실현손익 − 예상세금이다", () => {
    const buy = placeOrder({ account: acct({ cashKrw: 100_000_000 }), asset: samsung, side: "buy", quantity: 10, price: 200_000, fxKrwPerUsd: null, rules: R }, []);
    if (!buy.ok) throw new Error("buy failed");
    const m = computeMetrics({
      account: buy.account,
      trades: [buy.trade],
      assets: new Map([[samsung.id, samsung]]),
      priceKrw: () => 250_000,
      realizedKrw: 3_000_000,
      estimatedTaxKrw: 500_000,
    });
    expect(m.valueKrw).toBeCloseTo(2_500_000, 4);
    expect(m.unrealizedKrw).toBeCloseTo(2_500_000 - 2_000_000 * 1.00015, 4);
    expect(m.netAfterTaxKrw).toBeCloseTo(m.unrealizedKrw + 3_000_000 - 500_000, 4);
    expect(m.feesKrw).toBeCloseTo(2_000_000 * 0.00015, 6);
  });

  it("시세를 못 받은 종목은 합계에서 빠지고 개수로 알려준다", () => {
    const buy = placeOrder({ account: acct({ cashKrw: 100_000_000 }), asset: samsung, side: "buy", quantity: 10, price: 200_000, fxKrwPerUsd: null, rules: R }, []);
    if (!buy.ok) throw new Error("buy failed");
    const m = computeMetrics({
      account: buy.account,
      trades: [buy.trade],
      assets: new Map([[samsung.id, samsung]]),
      priceKrw: () => null,
      realizedKrw: 0,
      estimatedTaxKrw: 0,
    });
    expect(m.missingQuotes).toBe(1);
    expect(m.valueKrw).toBe(0);
  });

  it("금융소득종합과세 경고는 2,000만원에서 넘어간다", () => {
    expect(financialIncomeWarning(19_999_999).level).toBe("near");
    expect(financialIncomeWarning(20_000_000).level).toBe("over");
    expect(financialIncomeWarning(1_000_000).level).toBe("none");
  });
});

describe("장 상태", () => {
  it("코인은 항상 열려 있다", () => {
    expect(marketState("crypto").phase).toBe("always_open");
  });

  it("일요일에는 국내장이 닫혀 있다", () => {
    const sunday = new Date("2026-09-06T05:00:00Z"); // 일요일 14:00 KST
    expect(marketState("kr_stock", sunday).phase).toBe("closed");
  });

  it("평일 장중에는 열려 있다", () => {
    const wed = new Date("2026-09-02T02:00:00Z"); // 수요일 11:00 KST
    expect(marketState("kr_stock", wed).phase).toBe("open");
  });
});
