/**
 * 세율·한도 룰셋.
 *
 * 세법은 바뀐다. 그래서 숫자를 계산 코드에 박지 않고 여기 한 곳에 모아
 * 버전을 붙였다. 각 항목에는 근거와 확정 여부(status)를 같이 둔다.
 * UI는 어떤 룰셋으로 계산했는지와 미확정 항목을 항상 표시한다.
 *
 * ⚠️ 이 값들은 공개된 자료를 정리한 것이고 세무 검토를 받은 것이 아니다.
 *    실제 신고·납부 판단에 쓰지 말 것. (src/lib/tax/DISCLAIMER 참고)
 */

export type RuleStatus = "enacted" | "proposed";

export interface Sourced<T> {
  value: T;
  /** enacted = 시행 중 / proposed = 발표됐으나 확정 전 */
  status: RuleStatus;
  /** 사람이 읽을 근거 한 줄 */
  note: string;
}

const enacted = <T>(value: T, note: string): Sourced<T> => ({ value, status: "enacted", note });
const proposed = <T>(value: T, note: string): Sourced<T> => ({ value, status: "proposed", note });

/** 국내 상장시장 구분 — 매도 시 거래세율이 다르다 */
export type KrMarket = "KOSPI" | "KOSDAQ" | "KONEX";

export interface IsaRules {
  /** 연간 납입한도 (원) */
  annualContributionLimit: Sourced<number>;
  /** 총 납입한도 (원) */
  totalContributionLimit: Sourced<number>;
  /** 의무보유기간 (년) — 채우지 못하고 수익을 인출하면 혜택이 사라진다 */
  mandatoryHoldingYears: Sourced<number>;
  /** 일반형 비과세 한도 (원) */
  taxFreeLimitGeneral: Sourced<number>;
  /** 서민형 비과세 한도 (원) */
  taxFreeLimitLowIncome: Sourced<number>;
  /** 비과세 한도 초과분 분리과세율 */
  separateTaxRate: Sourced<number>;
}

export interface TaxRuleSet {
  id: string;
  label: string;
  /** 이 룰셋 전체가 확정인지 */
  status: RuleStatus;
  effectiveFrom: string;
  /** 매도 시 증권거래세(농특세 포함) — 시장별 */
  krSellTaxRate: Record<KrMarket, Sourced<number>>;
  /** 국내주식 배당소득세 (지방소득세 포함) */
  krDividendTaxRate: Sourced<number>;
  /** 해외주식 양도소득 기본공제 (원/년) */
  overseasCapitalGainDeduction: Sourced<number>;
  /** 해외주식 양도소득세율 (지방소득세 포함) */
  overseasCapitalGainTaxRate: Sourced<number>;
  /** 가상자산 과세 시작 연도 — 그 전에는 과세하지 않는다 */
  cryptoTaxStartYear: Sourced<number>;
  /** 가상자산 기본공제 (원/년) */
  cryptoDeduction: Sourced<number>;
  /** 가상자산 세율 (지방소득세 포함) */
  cryptoTaxRate: Sourced<number>;
  isa: IsaRules;
}

/** 현재 시행 중인 룰 (2026년) */
export const RULES_2026: TaxRuleSet = {
  id: "kr-2026",
  label: "2026년 현행",
  status: "enacted",
  effectiveFrom: "2026-01-01",
  krSellTaxRate: {
    KOSPI: enacted(0.002, "증권거래세 0.05% + 농어촌특별세 0.15% = 0.20% (2026.01.01 인상)"),
    KOSDAQ: enacted(0.002, "증권거래세 0.20% (2026.01.01 인상, 농특세 없음)"),
    KONEX: enacted(0.001, "증권거래세 0.10%"),
  },
  krDividendTaxRate: enacted(0.154, "배당소득세 14% + 지방소득세 1.4%"),
  overseasCapitalGainDeduction: enacted(2_500_000, "해외주식 양도소득 기본공제 연 250만원"),
  overseasCapitalGainTaxRate: enacted(0.22, "양도소득세 20% + 지방소득세 2%"),
  cryptoTaxStartYear: enacted(2027, "가상자산 과세 2027년 시행으로 유예"),
  cryptoDeduction: proposed(2_500_000, "시행 시 기본공제 연 250만원 예정"),
  cryptoTaxRate: proposed(0.22, "시행 시 20% + 지방소득세 2% 예정"),
  isa: {
    annualContributionLimit: enacted(20_000_000, "연 2,000만원"),
    totalContributionLimit: enacted(100_000_000, "총 1억원"),
    mandatoryHoldingYears: enacted(3, "의무보유 3년"),
    taxFreeLimitGeneral: enacted(2_000_000, "일반형 순이익 200만원까지 비과세"),
    taxFreeLimitLowIncome: enacted(4_000_000, "서민형·농어민형 400만원까지 비과세"),
    separateTaxRate: enacted(0.099, "비과세 한도 초과분 9.9% 분리과세"),
  },
};

/**
 * 발표된 ISA 개편안. 아직 확정 전이라 기본값이 아니다.
 * 화면에서 현행과 나란히 놓고 차이를 보게 하는 용도.
 */
export const RULES_2026_ISA_REFORM: TaxRuleSet = {
  ...RULES_2026,
  id: "kr-2026-isa-reform",
  label: "ISA 개편안 (미확정)",
  status: "proposed",
  effectiveFrom: "미정",
  isa: {
    annualContributionLimit: proposed(40_000_000, "연 4,000만원으로 확대 (발표, 확정 전)"),
    totalContributionLimit: proposed(200_000_000, "총 2억원으로 확대 (발표, 확정 전)"),
    mandatoryHoldingYears: enacted(3, "의무보유 3년 (변동 없음)"),
    taxFreeLimitGeneral: proposed(5_000_000, "일반형 500만원으로 확대 (발표, 확정 전)"),
    taxFreeLimitLowIncome: proposed(10_000_000, "서민형 1,000만원으로 확대 (발표, 확정 전)"),
    separateTaxRate: enacted(0.099, "초과분 9.9% (변동 없음)"),
  },
};

export const RULE_SETS = [RULES_2026, RULES_2026_ISA_REFORM] as const;
export const DEFAULT_RULE_SET_ID = RULES_2026.id;

export function getRuleSet(id: string): TaxRuleSet {
  return RULE_SETS.find((r) => r.id === id) ?? RULES_2026;
}

/** 룰셋 안에서 status가 proposed인 항목만 뽑는다 — UI 경고 배지용 */
export function proposedItems(rs: TaxRuleSet): string[] {
  const out: string[] = [];
  const walk = (obj: unknown, path: string) => {
    if (!obj || typeof obj !== "object") return;
    if ("status" in obj && "note" in obj) {
      const s = obj as Sourced<unknown>;
      if (s.status === "proposed") out.push(`${path}: ${s.note}`);
      return;
    }
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(rs.krSellTaxRate, "krSellTaxRate");
  walk(rs.isa, "isa");
  for (const k of ["krDividendTaxRate", "overseasCapitalGainDeduction", "overseasCapitalGainTaxRate", "cryptoTaxStartYear", "cryptoDeduction", "cryptoTaxRate"] as const) {
    walk(rs[k], k);
  }
  return out;
}

export const DISCLAIMER =
  "이 계산기는 공개 자료를 바탕으로 만든 학습·시뮬레이션 도구입니다. 세무 검토를 받은 것이 아니며 투자자문이 아닙니다. 실제 신고·납부나 투자 판단에는 사용하지 마세요.";
