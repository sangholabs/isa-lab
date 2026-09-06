export const won = (n: number, digits = 0) =>
  `${Math.round(n).toLocaleString("ko-KR", { maximumFractionDigits: digits })}원`;

export const wonShort = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}억원`;
  if (abs >= 10_000) return `${Math.round(n / 10_000).toLocaleString("ko-KR")}만원`;
  return won(n);
};

export const pct = (n: number | null, digits = 2) =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;

export const num = (n: number, digits = 4) =>
  n.toLocaleString("ko-KR", { maximumFractionDigits: digits });

/** 국내는 상승이 빨강, 하락이 파랑 */
export const signColor = (n: number | null) =>
  n == null || n === 0 ? "text-muted" : n > 0 ? "text-up" : "text-down";
