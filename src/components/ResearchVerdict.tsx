"use client";

import { useState } from "react";
import { Badge, Panel, Term } from "./ui";
import { won } from "@/lib/format";
import { buildConsensus, decisionChecklist, scoreAnalysis, type QualityScore } from "@/lib/research/score";
import { buildScenario } from "@/lib/research/scenario";
import { PROVIDER_MAP, type ProviderId, type ResearchResponse } from "@/lib/research/types";
import { KIND_LABEL, KIND_TAX_HINT } from "@/lib/universe";
import type { TaxRuleSet } from "@isa-lab/tax-engine/rules";
import type { AssetKind } from "@isa-lab/tax-engine/types";
import type { FeeSettings } from "@/lib/portfolio/types";

export function ResearchVerdict({
  res,
  kind,
  krMarket,
  rules,
  fees,
  existingRealized,
}: {
  res: ResearchResponse;
  kind: AssetKind;
  krMarket?: "KOSPI" | "KOSDAQ" | "KONEX";
  rules: TaxRuleSet;
  fees: FeeSettings;
  existingRealized: { kind: AssetKind; amount: number }[];
}) {
  const ok = res.results.filter((r) => r.ok && r.analysis);
  if (ok.length === 0) return null;

  const consensus = buildConsensus(res.results, (id) => PROVIDER_MAP.get(id as ProviderId)?.label ?? id);
  const scores = ok.map((r) => ({ label: PROVIDER_MAP.get(r.provider)!.label, s: scoreAnalysis(r.analysis!) }));
  const avg = Math.round(scores.reduce((a, x) => a + x.s.total, 0) / scores.length);

  const totalBear = ok.reduce((a, r) => a + r.analysis!.bear.length, 0);
  const totalSources = ok.reduce((a, r) => a + r.analysis!.sources.length, 0);
  const checklist = decisionChecklist({
    assetKindLabel: KIND_LABEL[kind],
    taxHint: KIND_TAX_HINT[kind],
    hasBearArgument: totalBear > 0,
    sourceCount: totalSources,
  });

  return (
    <div className="space-y-4">
      <Panel
        title="이 분석을 얼마나 믿을 수 있나"
        right={
          <Badge tone={avg >= 70 ? "live" : avg >= 45 ? "neutral" : "warn"}>
            신뢰도 {avg} / 100 · {avg >= 70 ? "높음" : avg >= 45 ? "보통" : "낮음"}
          </Badge>
        }
      >
        <p className="mb-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] leading-relaxed text-warn">
          이 점수는 <b>이 종목이 좋다는 뜻이 아닙니다.</b> 모델이 근거를 달았는지, 출처가 있는지, 양쪽을 다
          봤는지, 모르는 걸 모른다고 했는지를 채점한 것입니다. 점수가 높아도 결론이 틀릴 수 있고, 낮아도 맞을 수
          있습니다.
        </p>

        <div className="space-y-3">
          {scores.map(({ label, s }) => (
            <ScoreCard key={label} label={label} s={s} />
          ))}
        </div>
      </Panel>

      <Panel title="모델들이 어느 쪽으로 기울었나">
        {consensus.stances.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {consensus.stances.map((s) => (
              <span
                key={s.provider}
                className={`rounded-lg border px-2.5 py-1.5 text-[12px] ${
                  s.tilt === "bullish"
                    ? "border-up/40 bg-up/10 text-up"
                    : s.tilt === "bearish"
                      ? "border-down/40 bg-down/10 text-down"
                      : "border-line text-muted"
                }`}
              >
                {s.label} · {s.tilt === "bullish" ? "강세" : s.tilt === "bearish" ? "약세" : "중립"}
                <span className="ml-1.5 opacity-70">
                  ({s.bull}:{s.bear})
                </span>
              </span>
            ))}
          </div>
        )}
        <p className="text-[13px] leading-relaxed">{consensus.summary}</p>
        {consensus.agreement != null && (
          <p className="mt-2 text-[11px] text-muted">
            같은 방향으로 기운 비율 {consensus.agreement}% · 괄호 안은 강세논거:약세논거 개수입니다
          </p>
        )}
      </Panel>

      <Panel title="사기 전에 스스로 답할 것">
        <ol className="space-y-3">
          {checklist.map((c, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-line text-[11px] text-muted">
                {i + 1}
              </span>
              <div>
                <p className="text-[13px] leading-relaxed">{c.question}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{c.why}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          이 질문들은 모델이 만든 게 아닙니다. 종목이 무엇이든 사람이 답해야 하는 것들이고, 모델이 대신 답하면
          의미가 없습니다.
        </p>
      </Panel>

      <ScenarioPanel kind={kind} krMarket={krMarket} rules={rules} fees={fees} existingRealized={existingRealized} />
    </div>
  );
}

function ScoreCard({ label, s }: { label: string; s: QualityScore }) {
  return (
    <div className="rounded-lg border border-line bg-panel2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-medium">{label}</span>
        <span className="text-[12px] tabular-nums">{s.total} / 100</span>
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-panel">
        <div
          className={`h-full rounded-full ${
            s.total >= 70 ? "bg-emerald-500" : s.total >= 45 ? "bg-accent" : "bg-warn"
          }`}
          style={{ width: `${s.total}%` }}
        />
      </div>
      <ul className="space-y-1 text-[11px]">
        {s.items.map((i) => (
          <li key={i.key} className="flex items-start justify-between gap-2">
            <span className="text-muted">
              {i.label} <span className="opacity-60">— {i.detail}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {i.earned}/{i.max}
            </span>
          </li>
        ))}
      </ul>
      {s.caution && (
        <p className="mt-2 rounded-md border border-warn/40 bg-warn/10 px-2 py-1.5 text-[11px] text-warn">
          {s.caution}
        </p>
      )}
    </div>
  );
}

function ScenarioPanel({
  kind,
  krMarket,
  rules,
  fees,
  existingRealized,
}: {
  kind: AssetKind;
  krMarket?: "KOSPI" | "KOSDAQ" | "KONEX";
  rules: TaxRuleSet;
  fees: FeeSettings;
  existingRealized: { kind: AssetKind; amount: number }[];
}) {
  const [invest, setInvest] = useState(10_000_000);
  const sc = buildScenario({
    kind,
    krMarket,
    investKrw: invest,
    rules,
    fees,
    year: new Date().getFullYear(),
    existingRealized,
  });

  return (
    <Panel
      title="세후로 보면 얼마가 남나"
      right={
        <div className="flex flex-wrap gap-1">
          {[1_000_000, 5_000_000, 10_000_000, 50_000_000].map((v) => (
            <button
              key={v}
              onClick={() => setInvest(v)}
              className={`rounded-md border px-2 py-1 text-[11px] ${
                invest === v ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:bg-panel2"
              }`}
            >
              {v >= 100_000_000 ? `${v / 100_000_000}억` : `${v / 10_000}만`}
            </button>
          ))}
        </div>
      }
    >
      <p className="mb-3 text-[12px] leading-relaxed text-muted">
        {won(invest)}어치를 지금 사서 가격이 이만큼 변했을 때, 수수료와 세금을 뺀 뒤 손에 남는 금액입니다. 이건
        모델이 아니라 <b>세금 엔진이 계산한 결정론적 수치</b>입니다.
      </p>

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[520px] text-[12px]">
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th className="py-2 text-left font-normal">가격 변동</th>
              <th className="py-2 text-right font-normal">세전 손익</th>
              <th className="py-2 text-right font-normal">일반계좌 세후</th>
              <th className="py-2 text-right font-normal">ISA 세후</th>
              <th className="py-2 text-right font-normal">차이</th>
            </tr>
          </thead>
          <tbody>
            {sc.rows.map((r) => (
              <tr key={r.changePct} className="border-b border-line/50">
                <td className={`py-2 tabular-nums ${r.changePct > 0 ? "text-up" : "text-down"}`}>
                  {r.changePct > 0 ? "+" : ""}
                  {r.changePct}%
                </td>
                <td className="py-2 text-right tabular-nums text-muted">{won(r.grossKrw)}</td>
                <td className="py-2 text-right tabular-nums">{won(r.regularNetKrw)}</td>
                <td className="py-2 text-right tabular-nums">
                  {r.isaNetKrw == null ? "—" : won(r.isaNetKrw)}
                </td>
                <td
                  className={`py-2 text-right tabular-nums ${
                    r.savedKrw && r.savedKrw > 0 ? "text-accent" : "text-muted"
                  }`}
                >
                  {r.savedKrw == null ? "—" : r.savedKrw > 0 ? `+${won(r.savedKrw)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        {sc.note} 이 해에 이미 실현한 손익이 있으면 <Term k="기본공제">기본공제</Term>와 ISA 비과세 한도가 그만큼
        쓰인 상태로 계산합니다.
      </p>
    </Panel>
  );
}
