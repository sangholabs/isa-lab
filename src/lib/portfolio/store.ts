import type { PortfolioState } from "./types";
import { DEFAULT_RULE_SET_ID } from "@/lib/tax/rules";
import { DEFAULT_FEES } from "@/lib/tax/engine";
import { DEFAULT_WATCHLIST } from "@/lib/universe";

const KEY = "isa-lab:state:v1";

export function initialState(): PortfolioState {
  const openedAt = new Date().toISOString();
  return {
    version: 1,
    ruleSetId: DEFAULT_RULE_SET_ID,
    fees: { ...DEFAULT_FEES },
    watchlist: [...DEFAULT_WATCHLIST],
    accounts: [
      { id: "regular", name: "일반 위탁계좌", type: "regular", cashKrw: 10_000_000, openedAt, contributions: {} },
      { id: "isa", name: "ISA 중개형 (일반형)", type: "isa_general", cashKrw: 0, openedAt, contributions: {} },
    ],
    trades: [],
  };
}

/**
 * 저장소 어댑터.
 *
 * 공개 데모는 자격증명이 하나도 없어야 해서 브라우저 localStorage만 쓴다.
 * 인터페이스를 따로 뽑아 둔 이유는 나중에 서버 저장소(Supabase 등)를 붙일 때
 * 화면 코드를 건드리지 않기 위해서다. 지금 구현체는 local 하나뿐이다.
 */
export interface PortfolioStore {
  readonly name: "local" | "supabase";
  load(): Promise<PortfolioState>;
  save(state: PortfolioState): Promise<void>;
  reset(): Promise<void>;
}

export const localStore: PortfolioStore = {
  name: "local",
  async load() {
    if (typeof window === "undefined") return initialState();
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return initialState();
      const parsed = JSON.parse(raw) as PortfolioState;
      // 스키마가 바뀌면 조용히 깨지는 대신 초기화한다
      if (parsed.version !== 1 || !Array.isArray(parsed.accounts)) return initialState();
      // 예전에 저장된 상태에는 fees가 없다 — 기본값으로 채워 넣는다
      return { ...parsed, fees: { ...DEFAULT_FEES, ...(parsed.fees ?? {}) } };
    } catch {
      return initialState();
    }
  },
  async save(state) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // 사파리 프라이빗 모드 등에서 던진다. 저장 실패가 앱을 멈추면 안 된다.
    }
  },
  async reset() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
  },
};

export function getStore(): PortfolioStore {
  return localStore;
}
