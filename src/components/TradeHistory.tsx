"use client";

import { Badge, Empty, Panel, Stat, Term } from "./ui";
import { num, signColor, won } from "@/lib/format";
import { ASSET_MAP, KIND_LABEL } from "@/lib/universe";
import type { Trade } from "@/lib/portfolio/types";

export function TradeHistory({ trades, feesKrw }: { trades: Trade[]; feesKrw: number }) {
  const sorted = [...trades].sort((a, b) => b.at.localeCompare(a.at));
  const realized = sorted.filter((t) => t.realizedKrw != null);
  const wins = realized.filter((t) => (t.realizedKrw ?? 0) > 0).length;
  const realizedSum = realized.reduce((a, t) => a + (t.realizedKrw ?? 0), 0);

  return (
    <div className="space-y-4">
      <Panel title="매매 요약">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="총 거래" value={`${sorted.length}건`} sub={`매도 ${realized.length}건`} />
          <Stat
            label={<Term k="실현손익">실현손익 누계</Term>}
            value={won(realizedSum)}
            tone={realizedSum > 0 ? "up" : realizedSum < 0 ? "down" : undefined}
          />
          <Stat
            label="이익 낸 매도"
            value={realized.length === 0 ? "—" : `${wins} / ${realized.length}`}
            sub={realized.length === 0 ? undefined : `${((wins / realized.length) * 100).toFixed(0)}%`}
          />
          <Stat
            label={<Term k="증권거래세">누적 수수료·세금</Term>}
            value={won(feesKrw)}
            sub="체결 때마다 빠진 금액"
          />
        </div>
      </Panel>

      <Panel title="거래 내역">
        {sorted.length === 0 ? (
          <Empty>아직 거래가 없습니다. 대시보드에서 종목을 사고팔면 여기에 쌓입니다.</Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[640px] text-[12px]">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 text-left font-normal">일시</th>
                  <th className="py-2 text-left font-normal">종목</th>
                  <th className="py-2 text-center font-normal">구분</th>
                  <th className="py-2 text-right font-normal">수량</th>
                  <th className="py-2 text-right font-normal">단가</th>
                  <th className="py-2 text-right font-normal">비용</th>
                  <th className="py-2 text-right font-normal">실현손익</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const a = ASSET_MAP.get(t.assetId);
                  return (
                    <tr key={t.id} className="border-b border-line/50">
                      <td className="py-2 pr-2 whitespace-nowrap text-muted">
                        {new Date(t.at).toLocaleDateString("ko-KR", {
                          year: "2-digit",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">{a?.name ?? t.assetId}</div>
                        <div className="text-[11px] text-muted">{a ? KIND_LABEL[a.kind] : ""}</div>
                      </td>
                      <td className="py-2 text-center">
                        <Badge tone={t.side === "buy" ? "up" : "down"}>
                          {t.side === "buy" ? "매수" : "매도"}
                        </Badge>
                      </td>
                      <td className="py-2 text-right tabular-nums">{num(t.quantity)}</td>
                      <td className="py-2 text-right tabular-nums">
                        {a?.currency === "USD" ? `$${num(t.price, 2)}` : won(t.price)}
                        {t.fxKrwPerUsd && (
                          <div className="text-[11px] text-muted">
                            환율 {Math.round(t.fxKrwPerUsd).toLocaleString("ko-KR")}
                          </div>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted">{won(t.costKrw)}</td>
                      <td className={`py-2 text-right tabular-nums ${signColor(t.realizedKrw)}`}>
                        {t.realizedKrw == null ? "—" : won(t.realizedKrw)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
