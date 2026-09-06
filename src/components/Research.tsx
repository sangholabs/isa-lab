"use client";

import { useEffect, useState } from "react";
import { Badge, Empty, Modal, Panel } from "./ui";
import { num, won } from "@/lib/format";
import { KIND_LABEL, UNIVERSE } from "@/lib/universe";
import {
  PROVIDERS,
  PROVIDER_MAP,
  RESEARCH_DISCLAIMER,
  type Analysis,
  type ProviderId,
  type ResearchResponse,
} from "@/lib/research/types";
import type { Quote } from "@/lib/market/types";
import type { Holding } from "@/lib/portfolio/types";

const KEY = "isa-lab:llm-keys:v1";

interface KeyEntry {
  apiKey: string;
  model: string;
  enabled: boolean;
}
type KeyStore = Partial<Record<ProviderId, KeyEntry>>;

function loadKeys(): KeyStore {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as KeyStore) : {};
  } catch {
    return {};
  }
}

function saveKeys(v: KeyStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* 저장이 막혀도 이번 세션에서는 쓸 수 있게 둔다 */
  }
}

export function Research({
  quotes,
  priceKrw,
  holdings,
}: {
  quotes: Map<string, Quote>;
  priceKrw: (assetId: string) => number | null;
  holdings: Map<string, Holding>;
}) {
  const [keys, setKeys] = useState<KeyStore>({});
  const [showKeys, setShowKeys] = useState(false);
  const [assetId, setAssetId] = useState(UNIVERSE[0].id);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setKeys(loadKeys()), []);

  const active = PROVIDERS.filter((p) => keys[p.id]?.apiKey && keys[p.id]?.enabled !== false);

  function update(id: ProviderId, patch: Partial<KeyEntry>) {
    setKeys((prev) => {
      const meta = PROVIDER_MAP.get(id)!;
      const cur = prev[id] ?? { apiKey: "", model: meta.defaultModel, enabled: true };
      const next = { ...prev, [id]: { ...cur, ...patch } };
      saveKeys(next);
      return next;
    });
  }

  async function run() {
    setLoading(true);
    setError(null);
    setRes(null);
    try {
      const q = quotes.get(assetId);
      const h = holdings.get(assetId);
      const r = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          priceKrw: priceKrw(assetId),
          quote: q
            ? { price: q.price, currency: q.currency, changePercent: q.changePercent, asOf: q.asOf }
            : undefined,
          holding: h ? { quantity: h.quantity, avgCostKrw: h.avgCostKrw } : null,
          providers: active.map((p) => ({
            provider: p.id,
            apiKey: keys[p.id]!.apiKey.trim(),
            model: (keys[p.id]!.model || p.defaultModel).trim(),
          })),
        }),
      });
      const data = (await r.json()) as ResearchResponse & { error?: string };
      if (data.error) setError(data.error);
      else setRes(data);
    } catch {
      setError("요청을 보내지 못했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setLoading(false);
    }
  }

  const asset = UNIVERSE.find((a) => a.id === assetId)!;

  return (
    <div className="space-y-4">
      <Panel
        title="종목 리서치"
        right={
          <button
            onClick={() => setShowKeys(true)}
            className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-muted hover:bg-panel2"
          >
            API 키 {active.length > 0 ? `· ${active.length}개 연결됨` : "설정"}
          </button>
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="flex-1 rounded-lg border border-line bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((kind) => (
              <optgroup key={kind} label={KIND_LABEL[kind]}>
                {UNIVERSE.filter((a) => a.kind === kind).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={run}
            disabled={loading || active.length === 0}
            className="rounded-lg border border-accent/50 bg-accent/15 px-4 py-2 text-sm text-accent transition hover:bg-accent/25 disabled:opacity-30"
          >
            {loading ? `분석 중… (${active.length}개 모델)` : "분석 시작"}
          </button>
        </div>

        <p className="mt-2 text-[12px] text-muted">
          {asset.name} · {KIND_LABEL[asset.kind]} ·{" "}
          {priceKrw(assetId) != null ? won(priceKrw(assetId)!) : "시세 미수신"}
          {holdings.get(assetId) && ` · 보유 ${num(holdings.get(assetId)!.quantity)}`}
        </p>

        {active.length === 0 && (
          <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] text-warn">
            아직 연결된 모델이 없습니다. 오른쪽 위 <b>API 키 설정</b>에서 하나 이상 넣어주세요. 키는 브라우저에만
            저장되고 서버에 남지 않습니다.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-up/40 bg-up/10 px-3 py-2 text-[12px] text-up">{error}</p>
        )}
      </Panel>

      {res && <Results res={res} />}

      {!res && !loading && active.length > 0 && (
        <Panel>
          <Empty>
            종목을 고르고 <b>분석 시작</b>을 누르세요. 모델마다 강세·약세 논거를 따로 정리하고, 서로 갈리는
            지점을 위에 모아 보여줍니다.
          </Empty>
        </Panel>
      )}

      {showKeys && (
        <KeyDialog keys={keys} onChange={update} onClose={() => setShowKeys(false)} />
      )}
    </div>
  );
}

function Results({ res }: { res: ResearchResponse }) {
  const ok = res.results.filter((r) => r.ok && r.analysis);
  const failed = res.results.filter((r) => !r.ok);

  return (
    <div className="space-y-4">
      {res.disagreements.length > 0 && (
        <Panel title="모델들이 갈린 지점">
          <ul className="space-y-2 text-[13px] leading-relaxed">
            {res.disagreements.map((d, i) => (
              <li key={i} className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
                {d}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            의견이 갈린다는 건 그 부분이 아직 확정적이지 않다는 뜻입니다. 억지로 합치지 않고 그대로 둡니다.
          </p>
        </Panel>
      )}

      {failed.length > 0 && (
        <Panel title="호출 실패">
          <ul className="space-y-2 text-[12px]">
            {failed.map((f) => (
              <li key={f.provider} className="rounded-lg border border-up/40 bg-up/10 px-3 py-2 text-up">
                <b>{PROVIDER_MAP.get(f.provider)?.label}</b> ({f.model}) — {f.error}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            «model not found» 계열이면 모델 이름이 바뀐 것입니다. API 키 설정에서 모델 ID를 고쳐주세요.
          </p>
        </Panel>
      )}

      {ok.map((r) => (
        <AnalysisCard
          key={r.provider}
          label={PROVIDER_MAP.get(r.provider)!.label}
          model={r.model}
          elapsedMs={r.elapsedMs}
          a={r.analysis!}
        />
      ))}

      <p className="rounded-lg border border-line bg-panel2 p-3 text-[11px] leading-relaxed text-muted">
        {RESEARCH_DISCLAIMER}
      </p>
    </div>
  );
}

function AnalysisCard({
  label,
  model,
  elapsedMs,
  a,
}: {
  label: string;
  model: string;
  elapsedMs: number;
  a: Analysis;
}) {
  return (
    <Panel
      title={label}
      right={
        <div className="flex items-center gap-2">
          <Badge>{model}</Badge>
          <Badge tone={a.confidence >= 70 ? "live" : a.confidence >= 40 ? "neutral" : "warn"}>
            근거 확실성 {a.confidence}
          </Badge>
          <span className="text-[11px] text-muted">{(elapsedMs / 1000).toFixed(1)}초</span>
        </div>
      }
    >
      {a.summary && <p className="mb-4 text-[13px] leading-relaxed">{a.summary}</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        <ClaimList title="강세 논거" tone="up" items={a.bull} />
        <ClaimList title="약세 논거" tone="down" items={a.bear} />
      </div>

      {a.scenarios.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-medium">조건부 시나리오</p>
          <ul className="space-y-2">
            {a.scenarios.map((s, i) => (
              <li key={i} className="rounded-lg border border-line bg-panel2 p-2.5 text-[12px] leading-relaxed">
                <span className="text-accent">{s.condition}</span>
                <span className="mx-1.5 text-muted">→</span>
                <span>{s.implication}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {a.watchItems.length > 0 && <Bullets title="지켜볼 것" items={a.watchItems} />}
        {a.unknowns.length > 0 && <Bullets title="확인하지 못한 것" items={a.unknowns} warn />}
      </div>

      {a.sources.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-1.5 text-[11px] text-muted">출처</p>
          <ul className="space-y-1 text-[11px]">
            {a.sources.map((s, i) => (
              <li key={i} className="truncate">
                {/^https?:\/\//.test(s) ? (
                  <a
                    href={s}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent hover:underline"
                  >
                    {s}
                  </a>
                ) : (
                  <span className="text-muted">{s}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function ClaimList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "up" | "down";
  items: { point: string; evidence: string }[];
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === "up" ? "border-up/30 bg-up/5" : "border-down/30 bg-down/5"
      }`}
    >
      <p className={`mb-2 text-[12px] font-medium ${tone === "up" ? "text-up" : "text-down"}`}>
        {title} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="text-[12px] text-muted">모델이 내용을 채우지 않았습니다.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c, i) => (
            <li key={i} className="text-[12px] leading-relaxed">
              <p>{c.point}</p>
              {c.evidence && <p className="mt-0.5 text-[11px] text-muted">근거 — {c.evidence}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Bullets({ title, items, warn }: { title: string; items: string[]; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-warn/30 bg-warn/5" : "border-line bg-panel2"}`}>
      <p className={`mb-1.5 text-[12px] font-medium ${warn ? "text-warn" : ""}`}>{title}</p>
      <ul className="space-y-1 text-[12px] leading-relaxed text-muted">
        {items.map((s, i) => (
          <li key={i}>· {s}</li>
        ))}
      </ul>
    </div>
  );
}

function KeyDialog({
  keys,
  onChange,
  onClose,
}: {
  keys: KeyStore;
  onChange: (id: ProviderId, patch: Partial<KeyEntry>) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="API 키 · 모델 설정" onClose={onClose} wide>
      <div className="mb-4 rounded-lg border border-line bg-panel2 p-3 text-[12px] leading-relaxed text-muted">
        <p>
          키는 <b>이 브라우저에만</b> 저장됩니다. 서버는 요청을 중계만 하고 키를 저장하거나 기록하지 않습니다.
        </p>
        <p className="mt-1.5">
          모델 하나만 넣어도 됩니다. 여러 개를 넣으면 서로 다른 시각을 비교할 수 있고, 그만큼 요금이 나갑니다.
        </p>
        <p className="mt-1.5">공용 PC에서는 쓰지 마세요. 키 칸을 비우면 지워집니다.</p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((p) => (
          <ProviderRow key={p.id} meta={p} entry={keys[p.id]} onChange={onChange} />
        ))}
      </div>
    </Modal>
  );
}

function ProviderRow({
  meta,
  entry,
  onChange,
}: {
  meta: (typeof PROVIDERS)[number];
  entry: KeyEntry | undefined;
  onChange: (id: ProviderId, patch: Partial<KeyEntry>) => void;
}) {
  const [models, setModels] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const model = entry?.model ?? meta.defaultModel;

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: meta.id, apiKey: entry?.apiKey?.trim() ?? "" }),
      });
      const d = (await r.json()) as { models?: string[]; error?: string };
      if (d.error) setErr(d.error);
      else setModels(d.models ?? []);
    } catch {
      setErr("목록을 가져오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          {meta.label}
          {meta.webSearch && <Badge tone="live">웹 검색</Badge>}
        </span>
        <span className="flex gap-2 text-[11px]">
          <a href={meta.keyUrl} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">
            키 발급 ↗
          </a>
          <a href={meta.pricingUrl} target="_blank" rel="noreferrer noopener" className="text-muted hover:underline">
            요금표 ↗
          </a>
        </span>
      </div>

      {meta.note && <p className="mb-2 text-[11px] leading-relaxed text-muted">{meta.note}</p>}
      {meta.warning && (
        <p className="mb-2 rounded-md border border-warn/40 bg-warn/10 px-2 py-1.5 text-[11px] leading-relaxed text-warn">
          {meta.warning}
        </p>
      )}

      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={meta.keyHint}
        value={entry?.apiKey ?? ""}
        onChange={(ev) => onChange(meta.id, { apiKey: ev.target.value })}
        className="w-full rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-[11px] text-muted">모델</label>
        {models && models.length > 0 ? (
          <select
            value={models.includes(model) ? model : ""}
            onChange={(ev) => ev.target.value && onChange(meta.id, { model: ev.target.value })}
            className="min-w-0 flex-1 rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-[12px] outline-none focus:border-accent"
          >
            <option value="">{models.includes(model) ? "" : `직접 입력: ${model}`}</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={model}
            onChange={(ev) => onChange(meta.id, { model: ev.target.value })}
            className="min-w-0 flex-1 rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-[12px] tabular-nums outline-none focus:border-accent"
          />
        )}
        <button
          onClick={load}
          disabled={loading || (meta.listable && !entry?.apiKey)}
          className="shrink-0 rounded-md border border-line px-2 py-1.5 text-[11px] text-muted transition hover:border-accent hover:text-accent disabled:opacity-30"
        >
          {loading ? "불러오는 중…" : models ? "다시 불러오기" : "모델 목록"}
        </button>
      </div>

      {models && (
        <p className="mt-1 text-[11px] text-muted">
          {models.length}개 {meta.listable ? "· 계정에서 쓸 수 있는 모델입니다" : "· 코드에 든 후보입니다"}
          {!models.includes(model) && " · 지금 값은 목록에 없어 직접 입력으로 유지됩니다"}
        </p>
      )}
      {err && <p className="mt-1 text-[11px] text-up">{err}</p>}
    </div>
  );
}
