"use client";

import { useState } from "react";
import { Badge, Modal, Term } from "./ui";
import { DEFAULT_FEES } from "@/lib/tax/engine";
import { RULE_SETS, SOURCES, VERIFIED_AT, proposedItems, type TaxRuleSet } from "@/lib/tax/rules";
import type { FeeSettings } from "@/lib/portfolio/types";

/**
 * 수수료·세율 설정.
 *
 * 수수료는 공식 API로 받아올 수 없다 — 증권사 이벤트·등급·개설 경로에 따라
 * 공시 요율과 실제 요율이 다른 경우가 대부분이다. 그래서 프리셋을 주되
 * 사용자가 고친 값이 항상 이긴다.
 */

interface Preset {
  label: string;
  note: string;
  fees: Partial<FeeSettings>;
}

const PRESETS: Preset[] = [
  {
    label: "온라인 위탁 (기본값)",
    note: "국내 0.015% · 해외 0.07% · 환전 스프레드 0.1% · 코인 0.05%",
    fees: DEFAULT_FEES,
  },
  {
    label: "수수료 우대 계좌",
    note: "국내 0.0036% — 유관기관 제비용만 남는 이벤트 계좌",
    fees: { krBrokerFeeRate: 0.000036 },
  },
  {
    label: "일반 (비우대)",
    note: "국내 0.1% — 우대 없이 개설한 계좌에서 흔한 요율",
    fees: { krBrokerFeeRate: 0.001 },
  },
];

export function Settings({
  fees,
  rules,
  onChangeFees,
  onClose,
}: {
  fees: FeeSettings;
  rules: TaxRuleSet;
  onChangeFees: (f: FeeSettings) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"fees" | "tax">("fees");
  const proposed = proposedItems(rules);

  return (
    <Modal title="수수료 · 세율 설정" onClose={onClose} wide>
      <div className="mb-4 flex gap-1 rounded-lg border border-line bg-panel2 p-1">
        {(
          [
            { id: "fees", label: "수수료" },
            { id: "tax", label: "세율 출처" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[12px] transition ${
              tab === t.id ? "bg-accent/15 text-accent" : "text-muted hover:bg-panel"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fees" ? (
        <>
          <p className="mb-3 rounded-lg border border-line bg-panel2 p-3 text-[12px] leading-relaxed text-muted">
            증권사 수수료는 이벤트·등급·계좌 개설 경로에 따라 사람마다 다릅니다. 공시 요율을 그대로 쓰면 오히려
            시뮬레이션이 틀리기 때문에, 프리셋을 주되 <b>직접 넣은 값이 항상 우선</b>합니다. 본인 증권사 앱의
            수수료 안내에서 확인해 넣으세요.
          </p>

          <div className="mb-4 space-y-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => onChangeFees({ ...fees, ...p.fees })}
                className="w-full rounded-lg border border-line p-2.5 text-left transition hover:border-accent"
              >
                <p className="text-[12px] font-medium">{p.label}</p>
                <p className="mt-0.5 text-[11px] text-muted">{p.note}</p>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <FeeInput
              label="국내주식·ETF 위탁수수료"
              value={fees.krBrokerFeeRate}
              onChange={(v) => onChangeFees({ ...fees, krBrokerFeeRate: v })}
              hint="매수·매도 양쪽에 붙습니다. 유관기관 제비용 포함해서 넣으세요."
            />
            <FeeInput
              label="해외주식 위탁수수료"
              value={fees.overseasBrokerFeeRate}
              onChange={(v) => onChangeFees({ ...fees, overseasBrokerFeeRate: v })}
              hint="증권사마다 최소 수수료가 따로 있는 경우가 있는데, 여기서는 반영하지 않습니다."
            />
            <FeeInput
              label="환전 스프레드 (편도)"
              value={fees.fxSpreadRate}
              onChange={(v) => onChangeFees({ ...fees, fxSpreadRate: v })}
              hint="원화로 해외주식을 살 때 환전에서 빠지는 몫입니다. 우대율에 따라 달라집니다."
            />
            <FeeInput
              label="가상자산 거래 수수료"
              value={fees.cryptoFeeRate}
              onChange={(v) => onChangeFees({ ...fees, cryptoFeeRate: v })}
              hint="업비트 원화마켓 기본 0.05%. 거래소·등급마다 다릅니다."
            />
          </div>

          <button
            onClick={() => onChangeFees({ ...DEFAULT_FEES })}
            className="mt-4 w-full rounded-lg border border-line px-3 py-2 text-[12px] text-muted hover:bg-panel2"
          >
            기본값으로 되돌리기
          </button>
        </>
      ) : (
        <>
          <div className="mb-3 rounded-lg border border-line bg-panel2 p-3 text-[12px] leading-relaxed text-muted">
            <p>
              <b>세율을 API로 받아올 방법은 없습니다.</b> 국가법령정보 OPEN API는 법령 본문만 주고, 별표·부칙·
              특례가 얽혀 있어 자동으로 숫자를 뽑으면 조용히 틀립니다.
            </p>
            <p className="mt-1.5">
              그래서 사람이 확인해 코드에 적고, <b>확인한 날짜와 출처</b>를 함께 남깁니다. 세법 개정이 확정되는
              매년 12월에 다시 봐야 합니다.
            </p>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
            <Badge tone="accent">적용 룰셋 · {rules.label}</Badge>
            <Badge>시행일 {rules.effectiveFrom}</Badge>
            <Badge tone="live">확인일 {VERIFIED_AT}</Badge>
          </div>

          {proposed.length > 0 && (
            <div className="mb-3 rounded-lg border border-warn/40 bg-warn/10 p-3 text-[12px] text-warn">
              <p className="mb-1 font-medium">아직 확정되지 않은 항목</p>
              <ul className="space-y-1 leading-relaxed">
                {proposed.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-3 space-y-1.5 rounded-lg border border-line p-3 text-[12px]">
            <Line label="코스피 매도 거래세" v={rules.krSellTaxRate.KOSPI.note} />
            <Line label="코스닥 매도 거래세" v={rules.krSellTaxRate.KOSDAQ.note} />
            <Line label={<Term k="배당소득">배당소득세</Term>} v={rules.krDividendTaxRate.note} />
            <Line label={<Term k="양도소득">해외주식 양도세</Term>} v={rules.overseasCapitalGainTaxRate.note} />
            <Line label="해외주식 기본공제" v={rules.overseasCapitalGainDeduction.note} />
            <Line label={<Term k="가상자산">가상자산</Term>} v={rules.cryptoTaxStartYear.note} />
            <Line label="ISA 연간 납입한도" v={rules.isa.annualContributionLimit.note} />
            <Line label="ISA 비과세 한도 (일반형)" v={rules.isa.taxFreeLimitGeneral.note} />
            <Line label="ISA 비과세 한도 (서민형)" v={rules.isa.taxFreeLimitLowIncome.note} />
            <Line label={<Term k="의무보유기간" />} v={rules.isa.mandatoryHoldingYears.note} />
          </div>

          <p className="mb-1.5 text-[11px] text-muted">참고한 자료</p>
          <ul className="space-y-1 text-[11px]">
            {SOURCES.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent hover:underline"
                >
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            룰셋은 화면 위 선택창에서 바꿀 수 있습니다 ({RULE_SETS.map((r) => r.label).join(" / ")}).
          </p>
        </>
      )}
    </Modal>
  );
}

function Line({ label, v }: { label: React.ReactNode; v: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <span className="flex items-center gap-1 text-muted">{label}</span>
      <span className="max-w-[60%] text-right">{v}</span>
    </div>
  );
}

function FeeInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  const [text, setText] = useState((value * 100).toString());

  return (
    <div>
      <label className="mb-1 block text-[12px]">{label}</label>
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= 0 && v < 10) onChange(v / 100);
          }}
          className="w-28 rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-[12px] tabular-nums outline-none focus:border-accent"
        />
        <span className="text-[12px] text-muted">%</span>
        <span className="text-[11px] tabular-nums text-muted">
          100만원 거래 시 {Math.round(1_000_000 * value).toLocaleString("ko-KR")}원
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p>
    </div>
  );
}
