import type { AccountType, AssetKind } from "@/lib/tax/types";
import type { KrMarket } from "@/lib/tax/rules";

export interface Asset {
  id: string;
  kind: AssetKind;
  /** 시세 조회에 쓰는 심볼 (yahoo: 005930.KS / AAPL, upbit: KRW-BTC) */
  symbol: string;
  name: string;
  currency: "KRW" | "USD";
  krMarket?: KrMarket;
}

export interface Trade {
  id: string;
  accountId: string;
  assetId: string;
  side: "buy" | "sell";
  quantity: number;
  /** 체결 단가 (표시통화) */
  price: number;
  /** 체결 시점 환율 (해외자산일 때만) */
  fxKrwPerUsd: number | null;
  /** 수수료·세금 합계 (원화) */
  costKrw: number;
  /** 매도일 때만: 이 거래로 확정된 손익 (원화, 비용 차감 후) */
  realizedKrw: number | null;
  at: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** 원화 예수금 */
  cashKrw: number;
  openedAt: string;
  /** ISA 전용: 연도별 납입액 */
  contributions: Record<number, number>;
}

export interface Holding {
  assetId: string;
  quantity: number;
  /** 평균 매입단가 (원화 환산, 매수 비용 포함) */
  avgCostKrw: number;
}

export interface PortfolioState {
  accounts: Account[];
  trades: Trade[];
  watchlist: string[];
  ruleSetId: string;
  version: 1;
}
