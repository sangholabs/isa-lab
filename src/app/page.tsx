"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, Meter, Panel } from "@/components/ui";
import { TaxCompare } from "@/components/TaxCompare";
import { num, pct, signColor, won } from "@/lib/format";
import { ASSET_MAP, KIND_LABEL, KIND_TAX_HINT, UNIVERSE } from "@/lib/universe";
import { annualTaxForAccount, buildHoldings, deposit, placeOrder } from "@/lib/portfolio/engine";
import { getStore, initialState } from "@/lib/portfolio/store";
import { demoState } from "@/lib/demo";
import type { PortfolioState } from "@/lib/portfolio/types";
import type { Quote, QuoteResult } from "@/lib/market/types";
import { DISCLAIMER, RULE_SETS, getRuleSet } from "@/lib/tax/rules";
import { checkContribution, holdingStatus } from "@/lib/tax/isa";
import { compareIsa } from "@/lib/tax/engine";
import { isIsa } from "@/lib/tax/types";

const store = getStore();
const YEAR = new Date().getFullYear();

export default function Page() {
  const [state, setState] = useState<PortfolioState | null>(null);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [fx, setFx] = useState<{ rate: number | null; stale: boolean }>({ rate: null, stale: true });
  const [failures, setFailures] = useState<QuoteResult["failures"]>([]);
  const [accountId, setAccountId] = useState("regular");
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  useEffect(() => {
    store.load().then(setState);
  }, []);

  useEffect(() => {
    if (state) void store.save(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const rules = getRuleSet(state?.ruleSetId ?? "kr-2026");
  const account = state?.accounts.find((a) => a.id === accountId) ?? null;

  /** 워치리스트 + 보유종목을 합쳐 한 번에 조회한다 */
  const trackedIds = useMemo(() => {
    if (!state) return [];
    const held = new Set(state.trades.map((t) => t.assetId));
    return [...new Set([...state.watchlist, ...held])];
  }, [state]);

  const refresh = useCallback(async () => {
    if (trackedIds.length === 0) return;
    setLoadingQuotes(true);
    try {
      const res = await fetch(`/api/quotes?ids=${trackedIds.join(",")}`);
      const data = (await res.json()) as QuoteResult & { error?: string };
      if (data.error) {
        setToast({ text: data.error, bad: true });
        return;
      }
      setQuotes(new Map(data.quotes.map((q) => [q.instrumentId, q])));
      setFx({ rate: data.fxKrwPerUsd, stale: data.fxStale });
      setFailures(data.failures);
    } catch {
      setToast({ text: "시세 서버에 닿지 못했습니다. 잠시 후 다시 시도하세요.", bad: true });
    } finally {
      setLoadingQuotes(false);
    }
  }, [trackedIds]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (!state || !account) {
    return <main className="p-10 text-sm text-muted">불러오는 중…</main>;
  }

  const holdings = buildHoldings(state.trades, account.id);

  const priceKrw = (assetId: string): number | null => {
    const q = quotes.get(assetId);
    if (!q) return null;
    if (q.currency === "KRW") return q.price;
    return fx.rate == null ? null : q.price * fx.rate;
  };

  const evaluation = [...holdings.values()].reduce(
    (acc, h) => {
      const p = priceKrw(h.assetId);
      if (p == null) return acc;
      acc.value += p * h.quantity;
      acc.cost += h.avgCostKrw * h.quantity;
      return acc;
    },
    { value: 0, cost: 0 },
  );
  const unrealized = evaluation.value - evaluation.cost;
  const totalAssets = account.cashKrw + evaluation.value;

  function trade(assetId: string, side: "buy" | "sell", quantity: number) {
    const asset = ASSET_MAP.get(assetId)!;
    const q = quotes.get(assetId);
    if (!q) return setToast({ text: "시세를 아직 못 받았습니다.", bad: true });

    const res = placeOrder(
      { account: account!, asset, side, quantity, price: q.price, fxKrwPerUsd: fx.rate, rules },
      state!.trades,
    );
    if (!res.ok) return setToast({ text: res.reason, bad: true });

    setState((s) =>
      s
        ? {
            ...s,
            trades: [...s.trades, res.trade],
            accounts: s.accounts.map((a) => (a.id === res.account.id ? res.account : a)),
          }
        : s,
    );
    setToast({
      text: `${asset.name} ${quantity}주 ${side === "buy" ? "매수" : "매도"} 체결 · 비용 ${won(res.trade.costKrw)}`,
    });
  }

  function addCash(amount: number) {
    const res = deposit({ account: account!, amount, rules, year: YEAR });
    if (!res.ok) return setToast({ text: res.reason, bad: true });
    setState((s) => (s ? { ...s, accounts: s.accounts.map((a) => (a.id === res.account.id ? res.account : a)) } : s));
    setToast({ text: `${won(amount)} 입금 완료` });
  }

  const realizedThisYear = state.trades
    .filter((t) => t.accountId === account.id && t.realizedKrw != null && new Date(t.at).getFullYear() === YEAR)
    .map((t) => ({ kind: ASSET_MAP.get(t.assetId)!.kind, amount: t.realizedKrw! }));

  const comparison = compareIsa({ year: YEAR, rules, realized: realizedThisYear });
  const currentTax = annualTaxForAccount({ state, assets: ASSET_MAP, account, year: YEAR, rules });

  const contribution = isIsa(account.type)
    ? checkContribution({
        rules,
        ledger: account.contributions,
        openedYear: new Date(account.openedAt).getFullYear(),
        year: YEAR,
        amount: 1,
      })
    : null;
  const holding = isIsa(account.type)
    ? holdingStatus({ rules, openedAt: new Date(account.openedAt), now: new Date() })
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            ISA Lab <span className="text-muted">· 통합 모의투자</span>
          </h1>
          <p className="mt-0.5 text-[12px] text-muted">
            국내주식 · 국내상장 ETF · 해외주식 · 코인을 한 화면에서 굴리고, ISA가 실제로 얼마를 아껴주는지 계산합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={state.ruleSetId}
            onChange={(e) => setState((s) => (s ? { ...s, ruleSetId: e.target.value } : s))}
            className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px]"
          >
            {RULE_SETS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setState((s) => (s ? demoState(s) : s))}
            className="rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-[12px] text-accent hover:bg-accent/20"
          >
            데모 채우기
          </button>
          <button
            onClick={() => setState(initialState())}
            className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px] text-muted hover:bg-panel2"
          >
            초기화
          </button>
          <button
            onClick={() => void refresh()}
            className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px] hover:bg-panel2"
          >
            {loadingQuotes ? "조회 중…" : "새로고침"}
          </button>
        </div>
      </header>

      {(failures.length > 0 || fx.stale) && (
        <div className="mb-4 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] text-warn">
          {failures.length > 0 && (
            <p>
              일부 시세를 못 가져왔습니다 —{" "}
              {failures.map((f) => `${ASSET_MAP.get(f.instrumentId)?.name ?? f.instrumentId}(${f.reason})`).join(", ")}
            </p>
          )}
          {fx.stale && fx.rate != null && <p>환율이 최신이 아닙니다. 마지막으로 받은 값으로 환산했습니다.</p>}
          {fx.rate == null && <p>환율을 못 가져와 해외자산 주문이 막혀 있습니다.</p>}
        </div>
      )}

      {/* 계좌 */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel
          title="계좌"
          right={
            <div className="flex gap-1">
              {state.accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccountId(a.id)}
                  className={`rounded-md border px-2 py-1 text-[11px] ${
                    a.id === accountId ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:bg-panel2"
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="총 자산" value={won(totalAssets)} />
            <Stat label="예수금" value={won(account.cashKrw)} />
            <Stat label="평가금액" value={won(evaluation.value)} />
            <Stat
              label="평가손익"
              value={won(unrealized)}
              tone={unrealized > 0 ? "up" : unrealized < 0 ? "down" : undefined}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[1_000_000, 5_000_000, 10_000_000].map((v) => (
              <button
                key={v}
                onClick={() => addCash(v)}
                className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:bg-panel2"
              >
                + {won(v)} 입금
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={isIsa(account.type) ? "ISA 한도·의무보유" : "계좌 안내"}>
          {contribution && holding ? (
            <div className="space-y-3">
              <Meter
                label={`${YEAR}년 납입 한도`}
                value={account.contributions[YEAR] ?? 0}
                max={rules.isa.annualContributionLimit.value}
              />
              <Meter
                label="총 납입 한도"
                value={Object.values(account.contributions).reduce((a, b) => a + b, 0)}
                max={rules.isa.totalContributionLimit.value}
              />
              <div className="rounded-md border border-line bg-panel2 p-2.5 text-[11px] leading-relaxed text-muted">
                <p>
                  올해 더 넣을 수 있는 금액{" "}
                  <span className="text-text">{won(contribution.remainingThisYear)}</span>
                </p>
                <p className="mt-1">
                  의무보유{" "}
                  {holding.satisfied ? (
                    <span className="text-text">충족</span>
                  ) : (
                    <span className="text-warn">{holding.monthsLeft}개월 남음</span>
                  )}{" "}
                  · 못 채우고 인출하면 혜택이 사라집니다
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[12px] leading-relaxed text-muted">
              일반 위탁계좌는 납입한도가 없습니다. 대신 국내상장 해외·채권 ETF의 매매차익이 배당소득으로 과세되고,
              손실과 통산되지 않습니다. ISA 탭으로 바꿔 같은 매매의 세금을 비교해 보세요.
            </p>
          )}
        </Panel>
      </div>

      {/* 워치리스트 */}
      <Panel
        className="mb-4"
        title="워치리스트"
        right={
          <div className="flex items-center gap-2">
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setState((s) => (s ? { ...s, watchlist: [...new Set([...s.watchlist, v])] } : s));
              }}
              className="rounded-md border border-line bg-panel px-2 py-1 text-[11px]"
            >
              <option value="">+ 종목 추가</option>
              {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((kind) => (
                <optgroup key={kind} label={KIND_LABEL[kind]}>
                  {UNIVERSE.filter((a) => a.kind === kind && !state.watchlist.includes(a.id)).map((a) => (
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
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[720px] text-[12px]">
            <thead className="text-muted">
              <tr className="border-b border-line">
                <th className="py-2 text-left font-normal">종목</th>
                <th className="py-2 text-right font-normal">현재가</th>
                <th className="py-2 text-right font-normal">등락</th>
                <th className="py-2 text-right font-normal">보유</th>
                <th className="py-2 text-right font-normal">평가손익</th>
                <th className="py-2 text-right font-normal">주문</th>
              </tr>
            </thead>
            <tbody>
              {UNIVERSE.filter((a) => state.watchlist.includes(a.id) || holdings.has(a.id)).map((a) => {
                const q = quotes.get(a.id);
                const p = priceKrw(a.id);
                const h = holdings.get(a.id);
                const pl = h && p != null ? p * h.quantity - h.avgCostKrw * h.quantity : null;
                return (
                  <tr key={a.id} className="border-b border-line/50">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{a.name}</span>
                        <Badge title={KIND_TAX_HINT[a.kind]} tone={a.kind === "kr_etf_other" ? "accent" : "neutral"}>
                          {KIND_LABEL[a.kind]}
                        </Badge>
                        {q?.stale && <Badge tone="warn">지연</Badge>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted">{KIND_TAX_HINT[a.kind]}</div>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {q ? (a.currency === "USD" ? `$${num(q.price, 2)}` : won(q.price)) : "—"}
                    </td>
                    <td className={`py-2 text-right tabular-nums ${signColor(q?.changePercent ?? null)}`}>
                      {pct(q?.changePercent ?? null)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{h ? num(h.quantity) : "—"}</td>
                    <td className={`py-2 text-right tabular-nums ${signColor(pl)}`}>{pl == null ? "—" : won(pl)}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => trade(a.id, "buy", a.kind === "crypto" ? 0.01 : 1)}
                          disabled={!q}
                          className="rounded-md border border-up/40 bg-up/10 px-2 py-1 text-[11px] text-up disabled:opacity-30"
                        >
                          매수
                        </button>
                        <button
                          onClick={() => trade(a.id, "sell", Math.min(h?.quantity ?? 0, a.kind === "crypto" ? 0.01 : 1))}
                          disabled={!q || !h}
                          className="rounded-md border border-down/40 bg-down/10 px-2 py-1 text-[11px] text-down disabled:opacity-30"
                        >
                          매도
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {state.trades.length === 0 && (
          <Empty>
            아직 보유 종목이 없습니다. ISA 계좌로 <b>TIGER 미국S&amp;P500</b>을 사고 팔아보면 절세 효과가 가장 잘 보입니다.
          </Empty>
        )}
      </Panel>

      <div className="mb-4">
        <TaxCompare
          year={YEAR}
          regular={comparison.regular}
          isa={comparison.isa}
          saved={comparison.saved}
          ruleLabel={rules.label}
          ruleStatus={rules.status}
          excludedKinds={comparison.excludedKinds}
        />
      </div>

      <Panel className="mb-4" title={`${account.name} 기준 예상 세금`}>
        <p className="text-2xl font-semibold tabular-nums">{won(currentTax.totalTax)}</p>
        <p className="mt-1 text-[12px] text-muted">
          {YEAR}년 실현손익 {realizedThisYear.length}건 기준. 매도해야 실현손익이 잡힙니다.
        </p>
      </Panel>

      <footer className="mt-6 rounded-lg border border-line bg-panel2 p-3 text-[11px] leading-relaxed text-muted">
        <p>{DISCLAIMER}</p>
        <p className="mt-1">
          시세 출처 — 국내·해외주식 Yahoo Finance, 가상자산 Upbit 공개 API, 환율 Yahoo Finance. 실거래 계좌와 연결되지
          않으며 모든 주문은 가상입니다.
        </p>
      </footer>

      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg border px-3 py-2 text-[12px] shadow-lg ${
            toast.bad ? "border-up/40 bg-up/15 text-up" : "border-line bg-panel text-text"
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg border border-line bg-panel2 p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={`mt-1 text-base font-semibold tabular-nums ${
          tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
