import { computeAnnualTax, computeTradeCost, DEFAULT_FEES, type FeeConfig } from "@/lib/tax/engine";
import { checkContribution, checkIsaEligibility } from "@/lib/tax/isa";
import type { TaxRuleSet } from "@/lib/tax/rules";
import { isIsa } from "@/lib/tax/types";
import type { Account, Asset, Holding, PortfolioState, Trade } from "./types";

export interface OrderRequest {
  account: Account;
  asset: Asset;
  side: "buy" | "sell";
  quantity: number;
  /** 표시통화 기준 체결가 */
  price: number;
  fxKrwPerUsd: number | null;
  rules: TaxRuleSet;
  fees?: FeeConfig;
  now?: Date;
}

export interface OrderRejected {
  ok: false;
  reason: string;
}

export interface OrderAccepted {
  ok: true;
  trade: Trade;
  /** 체결 후 계좌 (예수금·납입이력 반영) */
  account: Account;
  cashDelta: number;
}

export type OrderResult = OrderAccepted | OrderRejected;

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** 원화 환산. 해외자산인데 환율이 없으면 주문을 받지 않는다. */
function toKrw(amount: number, currency: "KRW" | "USD", fx: number | null): number | null {
  if (currency === "KRW") return amount;
  return fx == null ? null : amount * fx;
}

export function buildHoldings(trades: Trade[], accountId: string): Map<string, Holding> {
  const map = new Map<string, Holding>();
  for (const t of trades.filter((x) => x.accountId === accountId)) {
    const h = map.get(t.assetId) ?? { assetId: t.assetId, quantity: 0, avgCostKrw: 0 };
    if (t.side === "buy") {
      const notionalKrw = t.price * t.quantity * (t.fxKrwPerUsd ?? 1) + t.costKrw;
      const totalCost = h.avgCostKrw * h.quantity + notionalKrw;
      h.quantity += t.quantity;
      h.avgCostKrw = h.quantity > 0 ? totalCost / h.quantity : 0;
    } else {
      h.quantity -= t.quantity;
      if (h.quantity <= 1e-12) {
        h.quantity = 0;
        h.avgCostKrw = 0;
      }
    }
    map.set(t.assetId, h);
  }
  for (const [k, v] of map) if (v.quantity === 0) map.delete(k);
  return map;
}

/**
 * 주문 처리.
 *
 * 막는 경우를 먼저 전부 통과시킨 뒤에야 체결한다:
 *  - ISA에 담을 수 없는 자산
 *  - 예수금 부족 / 보유수량 부족
 *  - 해외자산인데 환율을 못 가져온 상태
 * "일단 체결하고 나중에 검사"하면 잔고가 음수가 되는 상태가 만들어진다.
 */
export function placeOrder(req: OrderRequest, existingTrades: Trade[]): OrderResult {
  const { account, asset, side, quantity, price, fxKrwPerUsd, rules } = req;
  const now = req.now ?? new Date();

  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, reason: "수량은 0보다 커야 합니다" };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, reason: "체결가가 올바르지 않습니다" };

  if (isIsa(account.type)) {
    const e = checkIsaEligibility(asset.kind);
    if (!e.ok) return { ok: false, reason: e.reason! };
  }

  const notionalKrw = toKrw(price * quantity, asset.currency, fxKrwPerUsd);
  if (notionalKrw == null) return { ok: false, reason: "환율을 가져오지 못해 해외자산 주문을 받을 수 없습니다" };

  const cost = computeTradeCost({
    kind: asset.kind,
    side,
    notional: notionalKrw,
    krMarket: asset.krMarket,
    fees: req.fees,
    rules,
  });

  const holdings = buildHoldings(existingTrades, account.id);
  const held = holdings.get(asset.id);

  if (side === "buy") {
    const need = notionalKrw + cost.total;
    if (account.cashKrw < need) {
      return { ok: false, reason: `예수금이 부족합니다 (필요 ${Math.ceil(need).toLocaleString("ko-KR")}원)` };
    }
    const trade: Trade = {
      id: uid(),
      accountId: account.id,
      assetId: asset.id,
      side,
      quantity,
      price,
      fxKrwPerUsd: asset.currency === "USD" ? fxKrwPerUsd : null,
      costKrw: cost.total,
      realizedKrw: null,
      at: now.toISOString(),
    };
    return {
      ok: true,
      trade,
      account: { ...account, cashKrw: account.cashKrw - need },
      cashDelta: -need,
    };
  }

  if (!held || held.quantity < quantity - 1e-12) {
    return { ok: false, reason: `보유 수량이 부족합니다 (보유 ${held?.quantity ?? 0})` };
  }

  const proceeds = notionalKrw - cost.total;
  const realized = proceeds - held.avgCostKrw * quantity;
  const trade: Trade = {
    id: uid(),
    accountId: account.id,
    assetId: asset.id,
    side,
    quantity,
    price,
    fxKrwPerUsd: asset.currency === "USD" ? fxKrwPerUsd : null,
    costKrw: cost.total,
    realizedKrw: realized,
    at: now.toISOString(),
  };
  return {
    ok: true,
    trade,
    account: { ...account, cashKrw: account.cashKrw + proceeds },
    cashDelta: proceeds,
  };
}

/** ISA 계좌에 돈을 넣는다. 한도를 넘으면 거부하고 얼마까지 되는지 알려준다. */
export function deposit(params: {
  account: Account;
  amount: number;
  rules: TaxRuleSet;
  year: number;
}): { ok: true; account: Account } | { ok: false; reason: string; allowed: number } {
  const { account, amount, rules, year } = params;
  if (!isIsa(account.type)) {
    if (amount <= 0) return { ok: false, reason: "입금액은 0보다 커야 합니다", allowed: 0 };
    return { ok: true, account: { ...account, cashKrw: account.cashKrw + amount } };
  }
  const check = checkContribution({
    rules,
    ledger: account.contributions,
    openedYear: new Date(account.openedAt).getFullYear(),
    year,
    amount,
  });
  if (!check.ok) return { ok: false, reason: check.reason ?? "납입할 수 없습니다", allowed: check.allowed };
  return {
    ok: true,
    account: {
      ...account,
      cashKrw: account.cashKrw + amount,
      contributions: { ...account.contributions, [year]: (account.contributions[year] ?? 0) + amount },
    },
  };
}

/** 해당 연도 실현손익을 세금 엔진이 먹는 모양으로 모은다 */
export function realizedForYear(
  state: PortfolioState,
  assets: Map<string, Asset>,
  accountId: string,
  year: number,
) {
  return state.trades
    .filter((t) => t.accountId === accountId && t.realizedKrw != null && new Date(t.at).getFullYear() === year)
    .map((t) => ({ kind: assets.get(t.assetId)!.kind, amount: t.realizedKrw! }));
}

export function annualTaxForAccount(params: {
  state: PortfolioState;
  assets: Map<string, Asset>;
  account: Account;
  year: number;
  rules: TaxRuleSet;
  isaHoldingSatisfied?: boolean;
}) {
  const realized = realizedForYear(params.state, params.assets, params.account.id, params.year);
  return computeAnnualTax({
    account: params.account.type,
    realized,
    rules: params.rules,
    year: params.year,
    isaHoldingSatisfied: params.isaHoldingSatisfied,
  });
}

export { DEFAULT_FEES };
