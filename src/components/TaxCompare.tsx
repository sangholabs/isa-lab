"use client";

import { Badge, Panel } from "./ui";
import { won } from "@/lib/format";
import type { AssetKind, TaxResult } from "@/lib/tax/types";
import { KIND_LABEL } from "@/lib/universe";

export function TaxCompare({
  year,
  regular,
  isa,
  saved,
  ruleLabel,
  ruleStatus,
  excludedKinds,
}: {
  year: number;
  regular: TaxResult;
  isa: TaxResult;
  saved: number;
  ruleLabel: string;
  ruleStatus: "enacted" | "proposed";
  excludedKinds: AssetKind[];
}) {
  return (
    <Panel
      title={`${year}년 정산 — 같은 매매를 두 계좌로 굴렸다면`}
      right={
        <Badge tone={ruleStatus === "proposed" ? "warn" : "neutral"}>
          {ruleLabel}
          {ruleStatus === "proposed" ? " · 미확정" : ""}
        </Badge>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Card label="일반 위탁계좌" amount={regular.totalTax} tone="up" />
        <Card label="ISA 중개형" amount={isa.totalTax} tone="down" />
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-3">
          <p className="text-[11px] text-muted">ISA로 아낀 세금</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-accent">{won(saved)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Breakdown title="일반 위탁계좌" result={regular} />
        <Breakdown title="ISA 중개형" result={isa} />
      </div>

      {excludedKinds.length > 0 && (
        <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] text-warn">
          {excludedKinds.map((k) => KIND_LABEL[k]).join(" · ")}은 ISA(중개형)에 담을 수 없어 이 비교에서 제외했습니다.
        </p>
      )}

      {[...new Set([...regular.assumptions, ...isa.assumptions])].length > 0 && (
        <div className="mt-4 rounded-lg border border-line bg-panel2 p-3">
          <p className="mb-1.5 text-[11px] font-medium text-muted">계산에 쓴 가정</p>
          <ul className="space-y-1 text-[12px] leading-relaxed text-muted">
            {[...new Set([...regular.assumptions, ...isa.assumptions])].map((a) => (
              <li key={a}>· {a}</li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function Card({ label, amount, tone }: { label: string; amount: number; tone: "up" | "down" }) {
  return (
    <div className="rounded-lg border border-line bg-panel2 p-3">
      <p className="text-[11px] text-muted">{label} 세금</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone === "up" ? "text-up" : "text-down"}`}>
        {won(amount)}
      </p>
    </div>
  );
}

function Breakdown({ title, result }: { title: string; result: TaxResult }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-medium">{title}</p>
      {result.lines.length === 0 ? (
        <p className="text-[12px] text-muted">실현손익이 없습니다.</p>
      ) : (
        <>
          {/* 모바일: 표 대신 항목 카드 */}
          <div className="space-y-2 sm:hidden">
            {result.lines.map((l, i) => (
              <div key={i} className="rounded-lg border border-line bg-panel2 p-2.5 text-[12px]">
                <div className="flex items-start justify-between gap-2">
                  <span>{l.label}</span>
                  <span className="shrink-0 tabular-nums font-medium">{won(l.tax)}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{l.note}</p>
                {(l.taxableBase > 0 || l.rate > 0) && (
                  <p className="mt-1 text-[11px] tabular-nums text-muted">
                    과세표준 {l.taxableBase ? won(l.taxableBase) : "—"}
                    {l.rate ? ` · 세율 ${(l.rate * 100).toFixed(1)}%` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>

          <table className="hidden w-full text-[12px] sm:table">
            <thead className="text-muted">
              <tr className="border-b border-line">
                <th className="py-1.5 text-left font-normal">항목</th>
                <th className="py-1.5 text-right font-normal">과세표준</th>
                <th className="py-1.5 text-right font-normal">세율</th>
                <th className="py-1.5 text-right font-normal">세금</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l, i) => (
                <tr key={i} className="border-b border-line/50 align-top">
                  <td className="py-1.5 pr-2">
                    <div>{l.label}</div>
                    <div className="text-[11px] text-muted">{l.note}</div>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{l.taxableBase ? won(l.taxableBase) : "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.rate ? `${(l.rate * 100).toFixed(1)}%` : "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{won(l.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
