import type { Account, Asset, Trade } from "./types";
import { buildHoldings } from "./engine";
import type { AssetKind } from "@/lib/tax/types";

export interface PositionRow {
  asset: Asset;
  quantity: number;
  avgCostKrw: number;
  /** 원화 환산 현재가. 시세를 못 받았으면 null */
  priceKrw: number | null;
  costKrw: number;
  valueKrw: number | null;
  pnlKrw: number | null;
  pnlPct: number | null;
  weight: number | null;
}

export interface PortfolioMetrics {
  positions: PositionRow[];
  /** 시세를 못 받은 종목 수 — 아래 합계가 불완전하다는 신호 */
  missingQuotes: number;
  cashKrw: number;
  costKrw: number;
  valueKrw: number;
  totalAssetsKrw: number;
  unrealizedKrw: number;
  unrealizedPct: number | null;
  realizedKrw: number;
  /** 매매하며 실제로 나간 수수료·거래세 합계 */
  feesKrw: number;
  estimatedTaxKrw: number;
  /** 평가손익 + 실현손익 − 예상세금 */
  netAfterTaxKrw: number;
  byKind: { kind: AssetKind; valueKrw: number; weight: number }[];
}

export function computeMetrics(params: {
  account: Account;
  trades: Trade[];
  assets: Map<string, Asset>;
  priceKrw: (assetId: string) => number | null;
  realizedKrw: number;
  estimatedTaxKrw: number;
}): PortfolioMetrics {
  const { account, trades, assets, priceKrw, realizedKrw, estimatedTaxKrw } = params;
  const mine = trades.filter((t) => t.accountId === account.id);
  const holdings = buildHoldings(trades, account.id);

  const positions: PositionRow[] = [];
  let costKrw = 0;
  let valueKrw = 0;
  let missingQuotes = 0;

  for (const h of holdings.values()) {
    const asset = assets.get(h.assetId);
    if (!asset) continue;
    const p = priceKrw(h.assetId);
    const cost = h.avgCostKrw * h.quantity;
    const value = p == null ? null : p * h.quantity;
    if (p == null) missingQuotes++;
    costKrw += cost;
    if (value != null) valueKrw += value;
    positions.push({
      asset,
      quantity: h.quantity,
      avgCostKrw: h.avgCostKrw,
      priceKrw: p,
      costKrw: cost,
      valueKrw: value,
      pnlKrw: value == null ? null : value - cost,
      pnlPct: value == null || cost === 0 ? null : ((value - cost) / cost) * 100,
      weight: null,
    });
  }

  for (const p of positions) {
    p.weight = p.valueKrw == null || valueKrw === 0 ? null : (p.valueKrw / valueKrw) * 100;
  }
  positions.sort((a, b) => (b.valueKrw ?? -1) - (a.valueKrw ?? -1));

  const byKindMap = new Map<AssetKind, number>();
  for (const p of positions) {
    if (p.valueKrw == null) continue;
    byKindMap.set(p.asset.kind, (byKindMap.get(p.asset.kind) ?? 0) + p.valueKrw);
  }
  const byKind = [...byKindMap.entries()]
    .map(([kind, v]) => ({ kind, valueKrw: v, weight: valueKrw === 0 ? 0 : (v / valueKrw) * 100 }))
    .sort((a, b) => b.valueKrw - a.valueKrw);

  const unrealizedKrw = valueKrw - costKrw;
  const feesKrw = mine.reduce((a, t) => a + t.costKrw, 0);

  return {
    positions,
    missingQuotes,
    cashKrw: account.cashKrw,
    costKrw,
    valueKrw,
    totalAssetsKrw: account.cashKrw + valueKrw,
    unrealizedKrw,
    unrealizedPct: costKrw === 0 ? null : (unrealizedKrw / costKrw) * 100,
    realizedKrw,
    feesKrw,
    estimatedTaxKrw,
    netAfterTaxKrw: unrealizedKrw + realizedKrw - estimatedTaxKrw,
    byKind,
  };
}

/**
 * 금융소득종합과세 경고.
 *
 * 국내상장 해외·채권 ETF 매매차익은 배당소득이라 다른 이자·배당과 합쳐
 * 연 2,000만원을 넘으면 종합과세로 넘어간다. ISA를 쓰는 큰 이유 중 하나가
 * 이 합산을 피하는 것인데, 화면에 안 나오면 보이지 않는다.
 */
export const FINANCIAL_INCOME_THRESHOLD = 20_000_000;

export interface FinancialIncomeWarning {
  level: "none" | "near" | "over";
  amount: number;
  message: string;
}

export function financialIncomeWarning(dividendIncomeKrw: number): FinancialIncomeWarning {
  if (dividendIncomeKrw >= FINANCIAL_INCOME_THRESHOLD) {
    return {
      level: "over",
      amount: dividendIncomeKrw,
      message:
        "배당소득으로 잡히는 금액이 연 2,000만원을 넘었습니다. 금융소득종합과세 대상이 되어 다른 소득과 합산해 누진세율이 적용될 수 있습니다. ISA 계좌에서는 이 합산에 들어가지 않습니다.",
    };
  }
  if (dividendIncomeKrw >= FINANCIAL_INCOME_THRESHOLD * 0.7) {
    return {
      level: "near",
      amount: dividendIncomeKrw,
      message:
        "배당소득으로 잡히는 금액이 연 2,000만원 기준선에 가까워졌습니다. 넘으면 금융소득종합과세 대상이 됩니다.",
    };
  }
  return { level: "none", amount: dividendIncomeKrw, message: "" };
}
