"use client";

import { Badge, Empty, Panel } from "./ui";
import { num, pct, signColor, won } from "@/lib/format";
import { KIND_LABEL, KIND_TAX_HINT, UNIVERSE } from "@/lib/universe";
import { marketState, sinceLabel } from "@/lib/market/marketState";
import type { Quote } from "@/lib/market/types";
import type { Asset, Holding } from "@/lib/portfolio/types";

export interface Row {
  asset: Asset;
  quote: Quote | undefined;
  priceKrw: number | null;
  holding: Holding | undefined;
  pnlKrw: number | null;
  pnlPct: number | null;
}

export function Watchlist({
  rows,
  watchlist,
  hasTrades,
  onAdd,
  onRemove,
  onOrder,
}: {
  rows: Row[];
  watchlist: string[];
  hasTrades: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onOrder: (asset: Asset, side: "buy" | "sell") => void;
}) {
  return (
    <Panel
      className="mb-4"
      title="워치리스트"
      right={
        <div className="flex flex-wrap items-center gap-2">
          <select
            value=""
            onChange={(e) => e.target.value && onAdd(e.target.value)}
            className="rounded-md border border-line bg-panel px-2 py-1 text-[11px]"
          >
            <option value="">+ 종목 추가</option>
            {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((kind) => (
              <optgroup key={kind} label={KIND_LABEL[kind]}>
                {UNIVERSE.filter((a) => a.kind === kind && !watchlist.includes(a.id)).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className="text-[11px] text-muted">20초마다 자동 갱신</span>
        </div>
      }
    >
      {/* 모바일: 카드. 표를 가로로 밀어보게 만들면 대부분 안 봅니다. */}
      <div className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <Card key={r.asset.id} row={r} onRemove={onRemove} onOrder={onOrder} />
        ))}
      </div>

      <div className="-mx-4 hidden overflow-x-auto px-4 sm:block">
        <table className="w-full min-w-[720px] text-[12px]">
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th className="py-2 text-left font-normal">종목</th>
              <th className="py-2 text-right font-normal">현재가</th>
              <th className="py-2 text-right font-normal">등락</th>
              <th className="py-2 text-right font-normal">보유 · 평단</th>
              <th className="py-2 text-right font-normal">평가손익</th>
              <th className="py-2 text-right font-normal">주문</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const { asset: a, quote: q, priceKrw: p, holding: h } = r;
              return (
                <tr key={a.id} className="border-b border-line/50">
                  <td className="py-2 pr-2">
                    <NameCell row={r} onRemove={onRemove} />
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {q ? (a.currency === "USD" ? `$${num(q.price, 2)}` : won(q.price)) : "—"}
                    {a.currency === "USD" && p != null && (
                      <div className="text-[11px] text-muted">{won(p)}</div>
                    )}
                  </td>
                  <td className={`py-2 text-right tabular-nums ${signColor(q?.changePercent ?? null)}`}>
                    {pct(q?.changePercent ?? null)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {h ? (
                      <>
                        {num(h.quantity)}
                        <div className="text-[11px] text-muted">{won(h.avgCostKrw)}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`py-2 text-right tabular-nums ${signColor(r.pnlKrw)}`}>
                    {r.pnlKrw == null ? (
                      "—"
                    ) : (
                      <>
                        {won(r.pnlKrw)}
                        <div className="text-[11px]">{pct(r.pnlPct)}</div>
                      </>
                    )}
                  </td>
                  <td className="py-2">
                    <Actions row={r} onOrder={onOrder} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!hasTrades && (
        <Empty>
          아직 매매가 없습니다. ISA 계좌로 <b>TIGER 미국S&amp;P500</b>을 사고 팔아보면 절세 효과가 가장 잘
          보입니다. 감이 안 잡히면 <b>시작하기</b> 탭부터 보세요.
        </Empty>
      )}
    </Panel>
  );
}

function NameCell({ row, onRemove }: { row: Row; onRemove: (id: string) => void }) {
  const { asset: a, quote: q, holding: h } = row;
  const ms = marketState(a.kind);
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{a.name}</span>
        <Badge tone={a.kind === "kr_etf_other" ? "accent" : "neutral"} title={KIND_TAX_HINT[a.kind]}>
          {KIND_LABEL[a.kind]}
        </Badge>
        <Badge tone={ms.phase === "closed" ? "neutral" : "live"} title={ms.hint}>
          {ms.phase === "closed" ? "종가" : ms.phase === "always_open" ? "실시간" : "장중"}
        </Badge>
        {q?.stale && <Badge tone="warn">지연</Badge>}
        {!h && (
          <button
            onClick={() => onRemove(a.id)}
            title="워치리스트에서 빼기"
            className="text-[11px] text-muted transition hover:text-up"
          >
            ✕
          </button>
        )}
      </div>
      <div className="mt-0.5 text-[11px] text-muted">
        {KIND_TAX_HINT[a.kind]}
        {q && ` · ${sinceLabel(q.asOf)}`}
      </div>
    </>
  );
}

function Actions({ row, onOrder }: { row: Row; onOrder: (a: Asset, s: "buy" | "sell") => void }) {
  return (
    <div className="flex justify-end gap-1">
      <button
        onClick={() => onOrder(row.asset, "buy")}
        disabled={!row.quote}
        className="rounded-md border border-up/40 bg-up/10 px-2.5 py-1 text-[11px] text-up disabled:opacity-30"
      >
        매수
      </button>
      <button
        onClick={() => onOrder(row.asset, "sell")}
        disabled={!row.quote || !row.holding}
        className="rounded-md border border-down/40 bg-down/10 px-2.5 py-1 text-[11px] text-down disabled:opacity-30"
      >
        매도
      </button>
    </div>
  );
}

function Card({
  row,
  onRemove,
  onOrder,
}: {
  row: Row;
  onRemove: (id: string) => void;
  onOrder: (a: Asset, s: "buy" | "sell") => void;
}) {
  const { asset: a, quote: q, priceKrw: p, holding: h } = row;
  return (
    <div className="rounded-lg border border-line bg-panel2 p-3">
      <NameCell row={row} onRemove={onRemove} />

      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold tabular-nums">
            {q ? (a.currency === "USD" ? `$${num(q.price, 2)}` : won(q.price)) : "—"}
          </p>
          {a.currency === "USD" && p != null && (
            <p className="text-[11px] tabular-nums text-muted">{won(p)}</p>
          )}
        </div>
        <p className={`text-[13px] tabular-nums ${signColor(q?.changePercent ?? null)}`}>
          {pct(q?.changePercent ?? null)}
        </p>
      </div>

      {h && (
        <div className="mt-2 flex justify-between rounded-md border border-line bg-panel px-2.5 py-2 text-[12px]">
          <span className="text-muted">
            {num(h.quantity)} · 평단 {won(h.avgCostKrw)}
          </span>
          <span className={`tabular-nums ${signColor(row.pnlKrw)}`}>
            {row.pnlKrw == null ? "—" : `${won(row.pnlKrw)} (${pct(row.pnlPct)})`}
          </span>
        </div>
      )}

      <div className="mt-2">
        <Actions row={row} onOrder={onOrder} />
      </div>
    </div>
  );
}
