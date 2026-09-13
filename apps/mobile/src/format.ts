/** 원 단위 숫자를 "1,234,567원"으로. */
export function won(n: number): string {
  const sign = n < 0 ? "-" : "";
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${s}원`;
}

/** "12.5" 같은 만원 단위 입력 문자열 → 원. 비어 있거나 숫자가 아니면 0. */
export function manwonToWon(text: string): number {
  const v = Number(text.replace(/,/g, "").trim());
  return Number.isFinite(v) ? Math.round(v * 10_000) : 0;
}

export function pct(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, "")}%`;
}
