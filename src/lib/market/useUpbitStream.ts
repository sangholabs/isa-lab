"use client";

import { useEffect, useRef, useState } from "react";

export interface LiveTick {
  market: string;
  price: number;
  previousClose: number;
  changePercent: number;
  at: number;
}

export type StreamStatus = "idle" | "connecting" | "live" | "retrying" | "unsupported";

/**
 * 업비트 ticker 프레임 → 화면이 쓰는 모양.
 *
 * 순수 함수로 빼둔 이유는 테스트 때문이다. WebSocket 자체는 브라우저에서만
 * 열리는데, 정작 틀리기 쉬운 건 연결이 아니라 이 변환이다.
 */
export function parseTickerFrame(raw: string): LiveTick | null {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const code = typeof d.code === "string" ? d.code : null;
  const price = typeof d.trade_price === "number" ? d.trade_price : null;
  if (!code || price == null || !Number.isFinite(price)) return null;

  const prev = typeof d.prev_closing_price === "number" ? d.prev_closing_price : price;
  const rate = typeof d.signed_change_rate === "number" ? d.signed_change_rate : 0;
  const ts = typeof d.trade_timestamp === "number" ? d.trade_timestamp : Date.now();
  return { market: code, price, previousClose: prev, changePercent: rate * 100, at: ts };
}

/**
 * 업비트 실시간 시세 (WebSocket).
 *
 * REST로 20초마다 긁으면 코인은 이미 다른 가격이다. 업비트는 인증 없이
 * WebSocket을 열어주고, WebSocket에는 CORS가 없어서 브라우저가 직접 붙을 수 있다.
 * 서버를 한 번 거치지 않으니 지연도 그만큼 줄어든다.
 *
 * 주식은 이렇게 못 한다 — 국내·해외 거래소의 실시간 시세는 무료로 열려 있지 않다.
 * 그래서 이 훅은 코인에만 쓰고, 주식은 종가/지연 시세임을 화면에 밝힌다.
 */
export function useUpbitStream(markets: string[]): {
  ticks: Map<string, LiveTick>;
  status: StreamStatus;
} {
  const [ticks, setTicks] = useState<Map<string, LiveTick>>(new Map());
  const [status, setStatus] = useState<StreamStatus>("idle");

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = [...markets].sort().join(",");
  // 렌더마다 상태를 새로 만들지 않도록, 들어온 틱은 ref에 모았다가 주기적으로 흘린다
  const bufRef = useRef<Map<string, LiveTick>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      setStatus("unsupported");
      return;
    }
    if (markets.length === 0) {
      setStatus("idle");
      return;
    }

    let closedByUs = false;

    const connect = () => {
      setStatus(retryRef.current === 0 ? "connecting" : "retrying");
      let ws: WebSocket;
      try {
        ws = new WebSocket("wss://api.upbit.com/websocket/v1");
      } catch {
        setStatus("unsupported");
        return;
      }
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("live");
        ws.send(
          JSON.stringify([
            { ticket: `isa-lab-${Date.now()}` },
            { type: "ticker", codes: markets },
            { format: "DEFAULT" },
          ]),
        );
      };

      ws.onmessage = (ev: MessageEvent) => {
        try {
          const text =
            typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data as ArrayBuffer);
          const tick = parseTickerFrame(text);
          if (tick) bufRef.current.set(tick.market, tick);
        } catch {
          /* 깨진 프레임 하나로 스트림을 끊지 않는다 */
        }
      };

      ws.onclose = () => {
        if (closedByUs) return;
        retryRef.current += 1;
        setStatus("retrying");
        const wait = Math.min(30_000, 2 ** Math.min(retryRef.current, 5) * 500);
        timerRef.current = setTimeout(connect, wait);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    // 초당 수십 틱이 와도 화면은 4Hz면 충분하다
    const flush = setInterval(() => {
      if (bufRef.current.size === 0) return;
      const snapshot = new Map(bufRef.current);
      setTicks((prev) => {
        const next = new Map(prev);
        for (const [k, v] of snapshot) next.set(k, v);
        return next;
      });
    }, 250);

    return () => {
      closedByUs = true;
      clearInterval(flush);
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
    // markets 배열은 매 렌더 새로 만들어지므로 정렬한 문자열로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ticks, status };
}
