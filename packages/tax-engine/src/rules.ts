/**
 * 세율·한도 룰셋.
 *
 * 세법은 바뀐다. 그래서 숫자를 계산 코드에 박지 않고 여기 한 곳에 모아
 * 버전을 붙였다. 각 항목에는 근거와 확정 여부(status)를 같이 둔다.
 * UI는 어떤 룰셋으로 계산했는지와 미확정 항목을 항상 표시한다.
 *
 * ⚠️ 이 값들은 공개된 자료를 정리한 것이고 세무 검토를 받은 것이 아니다.
 *    실제 신고·납부 판단에 쓰지 말 것. (아래 DISCLAIMER 참고)
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

/**
 * 세율을 API로 받아올 방법은 없다. 국가법령정보 OPEN API는 법령 "본문"만 주고,
 * 별표·부칙·특례가 얽혀 있어 자동 파싱은 조용히 틀린다. 그래서 사람이 확인해
 * 여기 적고, 언제 무엇을 보고 적었는지를 함께 남긴다.
 */
export const VERIFIED_AT = "2026-09-14";

export const SOURCES: { label: string; url: string }[] = [
  // 세율을 바꾼 개정본(대통령령 제36001호)에 고정한다. 「현행」 통합본 딥링크는 뒤에 다른 개정이 겹치면 다른 조문을 보여 준 적이 있다
  { label: "증권거래세율 — 증권거래세법 시행령 제5조 (대통령령 제36001호, 2026.1.1 시행)", url: "https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=282431" },
  { label: "유가증권시장 농어촌특별세 0.15% — 농어촌특별세법 제5조", url: "https://www.law.go.kr/법령/농어촌특별세법/제5조" },
  { label: "ETF 과세 — 국내주식형 비과세 · 해외지수 ETF 배당소득 (소득세법 시행령 제26조의2)", url: "https://www.law.go.kr/법령/소득세법시행령/제26조의2" },
  { label: "배당소득 원천징수 14% — 소득세법 제129조", url: "https://www.law.go.kr/법령/소득세법/제129조" },
  { label: "해외주식 양도소득 연 250만원 공제 — 소득세법 제103조", url: "https://www.law.go.kr/법령/소득세법/제103조" },
  { label: "해외주식 양도소득세율 20% — 소득세법 제104조", url: "https://www.law.go.kr/법령/소득세법/제104조" },
  { label: "금융소득종합과세 기준 연 2,000만원 — 소득세법 제14조③6호", url: "https://www.law.go.kr/법령/소득세법/제14조" },
  { label: "가상자산 과세 2027년 시행 — 국세청", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=40370&cntntsId=238935" },
  { label: "ISA 과세특례 — 조세특례제한법 제91조의18", url: "https://www.law.go.kr/법령/조세특례제한법/제91조의18" },
  { label: "ISA 손익통산 · 국내주식 손실 차감 — 조세특례제한법 시행령 제93조의4", url: "https://www.law.go.kr/법령/조세특례제한법시행령/제93조의4" },
];

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
  /** 금융소득(이자·배당) 종합과세 기준금액 (원/년) — 이 금액 "이하"는 분리과세로 끝난다 */
  financialIncomeThreshold: Sourced<number>;
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
  cryptoTaxStartYear: enacted(2027, "2027년 1월 1일 이후 양도분부터 과세 (2024.12 개정으로 유예)"),
  cryptoDeduction: enacted(2_500_000, "기본공제 연 250만원 (소득세법 제64조의3, 2027년 시행)"),
  cryptoTaxRate: enacted(0.22, "20% + 지방소득세 2% (2027년 시행)"),
  financialIncomeThreshold: enacted(20_000_000, "이자·배당소득 합계 연 2,000만원 초과 시 종합과세 (이하는 분리과세)"),
  isa: {
    annualContributionLimit: enacted(20_000_000, "연 2,000만원 (쓰지 않은 한도는 다음 해로 이월)"),
    totalContributionLimit: enacted(100_000_000, "총 1억원"),
    mandatoryHoldingYears: enacted(3, "의무보유 3년"),
    taxFreeLimitGeneral: enacted(2_000_000, "일반형 순이익 200만원까지 비과세"),
    taxFreeLimitLowIncome: enacted(4_000_000, "서민형·농어민형 400만원까지 비과세"),
    separateTaxRate: enacted(0.099, "비과세 한도 초과분 9.9% 분리과세"),
  },
};

export const RULE_SETS = [RULES_2026] as const;
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
  for (const k of ["krDividendTaxRate", "overseasCapitalGainDeduction", "overseasCapitalGainTaxRate", "cryptoTaxStartYear", "cryptoDeduction", "cryptoTaxRate", "financialIncomeThreshold"] as const) {
    walk(rs[k], k);
  }
  return out;
}

export const DISCLAIMER =
  "이 계산기는 공개 자료를 바탕으로 만든 학습·시뮬레이션 도구입니다. 세무 검토를 받은 것이 아니며 투자자문이 아닙니다. 실제 신고·납부나 투자 판단에는 사용하지 마세요.";
