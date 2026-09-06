import type { PortfolioState, Trade } from "@/lib/portfolio/types";

/**
 * 데모 시나리오.
 *
 * 처음 들어온 사람에게 ISA의 요점을 한 번에 보여주려고 만들었다.
 * 핵심은 국내상장 해외ETF 두 건 — 하나는 이익, 하나는 손실이다.
 * 일반계좌에서는 이 둘이 통산되지 않아 이익분 전체에 15.4%가 붙지만,
 * ISA에서는 통산한 뒤 비과세 한도를 뺀 금액에만 9.9%가 붙는다.
 */

let seq = 0;
const id = () => `demo-${++seq}`;
const at = (month: number, day: number) => new Date(new Date().getFullYear(), month - 1, day, 10, 0).toISOString();

function pair(
  accountId: string,
  assetId: string,
  qty: number,
  buyPrice: number,
  sellPrice: number,
  buyCost: number,
  sellCost: number,
  buyMonth: number,
  sellMonth: number,
): Trade[] {
  const realized = (sellPrice - buyPrice) * qty - buyCost - sellCost;
  return [
    { id: id(), accountId, assetId, side: "buy", quantity: qty, price: buyPrice, fxKrwPerUsd: null, costKrw: buyCost, realizedKrw: null, at: at(buyMonth, 12) },
    { id: id(), accountId, assetId, side: "sell", quantity: qty, price: sellPrice, fxKrwPerUsd: null, costKrw: sellCost, realizedKrw: realized, at: at(sellMonth, 20) },
  ];
}

export function demoState(base: PortfolioState): PortfolioState {
  seq = 0;
  const trades: Trade[] = [];

  for (const accountId of ["regular", "isa"]) {
    // 국내상장 해외 ETF — 이익 +1,000만원
    trades.push(...pair(accountId, "kr:360750", 1000, 20_000, 30_000, 3_000, 4_500, 2, 7));
    // 국내상장 채권 ETF — 손실 −800만원
    trades.push(...pair(accountId, "kr:305080", 800, 60_000, 50_000, 7_200, 6_000, 3, 8));
    // 국내주식 — 이익 (원래 비과세라 세금에 영향이 없다는 걸 보여준다)
    trades.push(...pair(accountId, "kr:005930", 30, 200_000, 255_000, 900, 16_450, 1, 8));
  }

  // 아직 들고 있는 포지션도 하나씩 남겨 둔다 — 평가손익 칸이 비어 있으면 화면이 반만 보인다
  for (const accountId of ["regular", "isa"]) {
    trades.push({
      id: id(),
      accountId,
      assetId: "kr:069500",
      side: "buy",
      quantity: 40,
      price: 98_000,
      fxKrwPerUsd: null,
      costKrw: 588,
      realizedKrw: null,
      at: at(5, 9),
    });
  }
  trades.push({
    id: id(),
    accountId: "regular",
    assetId: "us:NVDA",
    side: "buy",
    quantity: 12,
    price: 178.4,
    fxKrwPerUsd: 1_340,
    costKrw: 27_300,
    realizedKrw: null,
    at: at(6, 3),
  });

  const openedIsa = new Date();
  openedIsa.setMonth(openedIsa.getMonth() - 14);

  return {
    ...base,
    watchlist: [...new Set([...base.watchlist, "kr:305080", "kr:229200", "us:VOO"])],
    accounts: base.accounts.map((a) =>
      a.id === "isa"
        ? {
            ...a,
            cashKrw: 8_130_000,
            openedAt: openedIsa.toISOString(),
            contributions: { [openedIsa.getFullYear()]: 8_000_000, [new Date().getFullYear()]: 12_000_000 },
          }
        : { ...a, cashKrw: 5_260_000 },
    ),
    trades,
  };
}
