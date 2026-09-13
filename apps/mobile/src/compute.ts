import { compareIsa, computeAnnualTax, getRuleSet } from "@isa-lab/tax-engine";
import type { AssetKind, IsaComparison, RealizedPnl, TaxResult } from "@isa-lab/tax-engine";
import type { AppState } from "./state";
import { manwonToWon } from "./format";

export interface Outcome {
  comparison: IsaComparison;
  /** ISA에 담을 수 없어 비교에서 빠진 자산의 일반계좌 세금 — 어느 계좌든 똑같이 낸다 */
  outsideIsa: TaxResult | null;
  realized: RealizedPnl[];
}

export function toRealized(state: AppState): RealizedPnl[] {
  // 이익·손실을 합치지 않고 두 행으로 넘긴다 — 통산할지는 엔진이 정한다 (ADR-0004)
  return (Object.keys(state.entries) as AssetKind[])
    .flatMap((kind) => [
      { kind, amount: manwonToWon(state.entries[kind].profit) },
      { kind, amount: -manwonToWon(state.entries[kind].loss) },
    ])
    .filter((r) => r.amount !== 0);
}

export function compute(state: AppState): Outcome {
  const rules = getRuleSet(state.ruleSetId);
  const realized = toRealized(state);
  const base = { realized, rules, year: state.year, isaHoldingSatisfied: state.holdingSatisfied };
  const comparison = compareIsa({ ...base, isaType: state.isaType });
  const outside = realized.filter((r) => comparison.excludedKinds.includes(r.kind));
  const outsideIsa = outside.length ? computeAnnualTax({ ...base, realized: outside, account: "regular" }) : null;
  return { comparison, outsideIsa, realized };
}
