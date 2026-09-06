import type { AssetKind } from "@/lib/tax/types";

export type MarketPhase = "open" | "closed" | "always_open";

export interface MarketState {
  phase: MarketPhase;
  label: string;
  /** 화면에 붙일 한 줄 설명 */
  hint: string;
}

function parts(tz: string, now: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of f.formatToParts(now)) map[p.type] = p.value;
  return {
    weekday: map.weekday,
    minutes: Number(map.hour) * 60 + Number(map.minute),
  };
}

const WEEKEND = new Set(["Sat", "Sun"]);

/**
 * 장이 열려 있는지 판단한다.
 *
 * 공휴일은 반영하지 않는다 — 거래소 휴장일 달력을 들고 있지 않기 때문이다.
 * 그래서 "장중"이라고 표시해도 실제로는 휴장일 수 있고, 그 경우 시세의
 * asOf가 오래된 값으로 남는다. 화면에서는 asOf를 함께 보여줘서
 * 사용자가 직접 판단할 수 있게 한다.
 */
export function marketState(kind: AssetKind, now = new Date()): MarketState {
  if (kind === "crypto") {
    return { phase: "always_open", label: "24시간", hint: "가상자산 시장은 쉬지 않습니다" };
  }

  if (kind === "overseas_stock") {
    const { weekday, minutes } = parts("America/New_York", now);
    const open = !WEEKEND.has(weekday) && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
    return open
      ? { phase: "open", label: "미국장 장중", hint: "미국 정규장 09:30–16:00 (현지)" }
      : { phase: "closed", label: "미국장 마감", hint: "표시 가격은 마지막 거래일 종가입니다" };
  }

  const { weekday, minutes } = parts("Asia/Seoul", now);
  const open = !WEEKEND.has(weekday) && minutes >= 9 * 60 && minutes < 15 * 60 + 30;
  return open
    ? { phase: "open", label: "국내장 장중", hint: "정규장 09:00–15:30 (KST)" }
    : { phase: "closed", label: "국내장 마감", hint: "표시 가격은 마지막 거래일 종가입니다" };
}

/** 시세 시각이 얼마나 지났는지 사람이 읽는 문장으로 */
export function sinceLabel(asOf: string, now = new Date()): string {
  const diff = now.getTime() - new Date(asOf).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}
