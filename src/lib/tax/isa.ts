import type { TaxRuleSet } from "./rules";
import type { AssetKind } from "./types";
import { ISA_ELIGIBLE } from "./types";

/** ISA 계좌에 연도별로 얼마를 넣었는지 */
export type ContributionLedger = Record<number, number>;

export interface ContributionCheck {
  ok: boolean;
  /** 이번에 실제로 넣을 수 있는 금액 */
  allowed: number;
  reason?: string;
  /** 올해 남은 한도 (이월분 포함) */
  remainingThisYear: number;
  /** 총 한도에서 남은 금액 */
  remainingTotal: number;
}

/**
 * ISA 납입한도 검사.
 *
 * 쓰지 않은 연간 한도는 다음 해로 이월된다. 그래서 "올해 넣을 수 있는 돈"은
 * 연 한도가 아니라 (가입연도부터 올해까지의 누적 한도 − 지금까지 낸 돈)이다.
 * 총 한도가 더 낮으면 그쪽이 먼저 걸린다.
 */
export function checkContribution(params: {
  rules: TaxRuleSet;
  ledger: ContributionLedger;
  openedYear: number;
  year: number;
  amount: number;
}): ContributionCheck {
  const { rules, ledger, openedYear, year, amount } = params;
  const annual = rules.isa.annualContributionLimit.value;
  const total = rules.isa.totalContributionLimit.value;

  const paidSoFar = Object.values(ledger).reduce((a, b) => a + b, 0);
  const years = Math.max(0, year - openedYear + 1);
  const accruedAllowance = Math.min(annual * years, total);

  const remainingThisYear = Math.max(0, accruedAllowance - paidSoFar);
  const remainingTotal = Math.max(0, total - paidSoFar);
  const allowed = Math.min(amount, remainingThisYear, remainingTotal);

  if (amount <= 0) {
    return { ok: false, allowed: 0, reason: "납입액은 0보다 커야 합니다", remainingThisYear, remainingTotal };
  }
  if (allowed <= 0) {
    return {
      ok: false,
      allowed: 0,
      reason: remainingTotal <= 0 ? "총 납입한도를 모두 사용했습니다" : "올해 남은 납입한도가 없습니다",
      remainingThisYear,
      remainingTotal,
    };
  }
  if (allowed < amount) {
    return {
      ok: false,
      allowed,
      reason: `한도를 넘습니다. ${allowed.toLocaleString("ko-KR")}원까지 납입할 수 있습니다`,
      remainingThisYear,
      remainingTotal,
    };
  }
  return { ok: true, allowed, remainingThisYear, remainingTotal };
}

export interface EligibilityCheck {
  ok: boolean;
  reason?: string;
}

/** ISA(중개형)는 국내 상장 상품만 담는다. 해외주식 직접투자와 코인은 들어가지 않는다. */
export function checkIsaEligibility(kind: AssetKind): EligibilityCheck {
  if (ISA_ELIGIBLE.includes(kind)) return { ok: true };
  const why: Record<string, string> = {
    overseas_stock: "ISA(중개형)로는 해외 상장 주식을 직접 살 수 없습니다. 국내상장 해외ETF로 대신하세요.",
    crypto: "ISA(중개형)에는 가상자산을 담을 수 없습니다.",
  };
  return { ok: false, reason: why[kind] ?? "ISA에 담을 수 없는 자산입니다." };
}

export interface HoldingStatus {
  satisfied: boolean;
  yearsHeld: number;
  requiredYears: number;
  /** 남은 개월 수 */
  monthsLeft: number;
}

/** 의무보유기간 충족 여부 */
export function holdingStatus(params: {
  rules: TaxRuleSet;
  openedAt: Date;
  now: Date;
}): HoldingStatus {
  const { rules, openedAt, now } = params;
  const required = rules.isa.mandatoryHoldingYears.value;
  const months =
    (now.getFullYear() - openedAt.getFullYear()) * 12 + (now.getMonth() - openedAt.getMonth());
  const monthsLeft = Math.max(0, required * 12 - months);
  return {
    satisfied: monthsLeft === 0,
    yearsHeld: months / 12,
    requiredYears: required,
    monthsLeft,
  };
}
