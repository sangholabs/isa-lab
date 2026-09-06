import { describe, expect, it } from "vitest";
import { RULES_2026 } from "@/lib/tax/rules";
import { buildHoldings, deposit, placeOrder } from "@/lib/portfolio/engine";
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
