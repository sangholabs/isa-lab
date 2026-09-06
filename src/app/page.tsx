"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, ConfirmButton, Empty, Meter, Panel, Stat, Tabs, Term } from "@/components/ui";
import { TaxCompare } from "@/components/TaxCompare";
import { OrderDialog, type OrderIntent } from "@/components/OrderDialog";
import { TradeHistory } from "@/components/TradeHistory";
import { Watchlist, type Row } from "@/components/Watchlist";
import { Research } from "@/components/Research";
import { GettingStarted } from "@/components/GettingStarted";
import { Settings } from "@/components/Settings";
import { num, pct, signColor, won } from "@/lib/format";
import { ASSET_MAP, KIND_LABEL, KIND_TAX_HINT, UNIVERSE } from "@/lib/universe";
import { annualTaxForAccount, buildHoldings, deposit, placeOrder } from "@/lib/portfolio/engine";
import { computeMetrics, financialIncomeWarning } from "@/lib/portfolio/metrics";
import { getStore, initialState } from "@/lib/portfolio/store";
import { demoState } from "@/lib/demo";
import type { PortfolioState } from "@/lib/portfolio/types";
import type { Quote, QuoteResult } from "@/lib/market/types";
import { marketState, sinceLabel } from "@/lib/market/marketState";
import { useUpbitStream } from "@/lib/market/useUpbitStream";
import { DISCLAIMER, RULE_SETS, getRuleSet } from "@/lib/tax/rules";
import { checkContribution, holdingStatus } from "@/lib/tax/isa";
import { compareIsa } from "@/lib/tax/engine";
import { isIsa } from "@/lib/tax/types";

const store = getStore();
const YEAR = new Date().getFullYear();

type TabId = "dashboard" | "history" | "research" | "start";

const TABS: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "대시보드" },
  { id: "history", label: "매매 내역" },
  { id: "research", label: "리서치" },
  { id: "start", label: "시작하기" },
];

export default function Page() {
  const [state, setState] = useState<PortfolioState | null>(null);
  const [tab, setTab] = useState<TabId>("dashboard");
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [fx, setFx] = useState<{ rate: number | null; stale: boolean }>({ rate: null, stale: true });
  const [failures, setFailures] = useState<QuoteResult["failures"]>([]);
  const [accountId, setAccountId] = useState("regular");
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [order, setOrder] = useState<OrderIntent | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    store.load().then(setState);
  }, []);

  useEffect(() => {
    if (state) void store.save(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const rules = getRuleSet(state?.ruleSetId ?? "kr-2026");
  const account = state?.accounts.find((a) => a.id === accountId) ?? null;

  const trackedIds = useMemo(() => {
    if (!state) return [];
    const held = new Set(state.trades.map((t) => t.assetId));
    return [...new Set([...state.watchlist, ...held])];
  }, [state]);

  const cryptoMarkets = useMemo(
    () =>
      trackedIds
        .map((id) => ASSET_MAP.get(id))
        .filter((a) => a?.kind === "crypto")
        .map((a) => a!.symbol),
    [trackedIds],
  );
  const { ticks, status: streamStatus } = useUpbitStream(cryptoMarkets);

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

  /**
   * REST로 받은 시세 위에 WebSocket 틱을 덮는다.
   * 코인만 실시간이고 주식은 그대로 — 그 차이를 화면 배지로도 구분해 보여준다.
   */
  const liveQuotes = useMemo(() => {
    if (ticks.size === 0) return quotes;
    const merged = new Map(quotes);
    for (const [market, t] of ticks) {
      const id = `upbit:${market}`;
      const base = merged.get(id);
      merged.set(id, {
        instrumentId: id,
        price: t.price,
        currency: "KRW",
        previousClose: t.previousClose,
        changePercent: t.changePercent,
        source: "upbit",
        asOf: new Date(t.at).toISOString(),
        stale: false,
        ...(base ? {} : {}),
      });
    }
    return merged;
  }, [quotes, ticks]);

  const priceKrw = useCallback(
    (assetId: string): number | null => {
      const q = liveQuotes.get(assetId);
      if (!q) return null;
      if (q.currency === "KRW") return q.price;
      return fx.rate == null ? null : q.price * fx.rate;
    },
    [liveQuotes, fx.rate],
  );

  if (!state || !account) {
    return <main className="p-10 text-sm text-muted">불러오는 중…</main>;
  }

  const holdings = buildHoldings(state.trades, account.id);

  const realizedRows = state.trades
    .filter(
      (t) =>
        t.accountId === account.id && t.realizedKrw != null && new Date(t.at).getFullYear() === YEAR,
    )
    .map((t) => ({ kind: ASSET_MAP.get(t.assetId)!.kind, amount: t.realizedKrw! }));
  const realizedSum = realizedRows.reduce((a, r) => a + r.amount, 0);

  const currentTax = annualTaxForAccount({ state, assets: ASSET_MAP, account, year: YEAR, rules });
  const comparison = compareIsa({ year: YEAR, rules, realized: realizedRows });

  const metrics = computeMetrics({
    account,
    trades: state.trades,
    assets: ASSET_MAP,
    priceKrw,
    realizedKrw: realizedSum,
    estimatedTaxKrw: currentTax.totalTax,
  });

  // 배당소득으로 잡히는 실현이익만 골라 종합과세 기준선과 비교한다
  const dividendIncome = realizedRows
    .filter((r) => r.kind === "kr_etf_other" && r.amount > 0)
    .reduce((a, r) => a + r.amount, 0);
  const fiWarn = financialIncomeWarning(isIsa(account.type) ? 0 : dividendIncome);

  const overseasRealized = realizedRows
    .filter((r) => r.kind === "overseas_stock")
    .reduce((a, r) => a + r.amount, 0);

  const contribution = isIsa(account.type)
    ? checkContribution({
        rules,
        ledger: account.contributions,
        openedYear: new Date(account.openedAt).getFullYear(),
        year: YEAR,
        amount: 1,
      })
    : null;
  const holdStatus = isIsa(account.type)
    ? holdingStatus({ rules, openedAt: new Date(account.openedAt), now: new Date() })
    : null;

  function submitOrder(quantity: number) {
    if (!order || !account || !state) return;
    const q = liveQuotes.get(order.asset.id);
    if (!q) return setToast({ text: "시세를 아직 못 받았습니다.", bad: true });

    const res = placeOrder(
      {
        account,
        asset: order.asset,
        side: order.side,
        quantity,
        price: q.price,
        fxKrwPerUsd: fx.rate,
        rules,
        fees: state.fees,
      },
      state.trades,
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
    setOrder(null);
    setToast({
      text: `${order.asset.name} ${num(quantity)} ${order.side === "buy" ? "매수" : "매도"} 체결 · 비용 ${won(
        res.trade.costKrw,
      )}`,
    });
  }

  function addCash(amount: number) {
    if (!account) return;
    const res = deposit({ account, amount, rules, year: YEAR });
    if (!res.ok) return setToast({ text: res.reason, bad: true });
    setState((s) =>
      s ? { ...s, accounts: s.accounts.map((a) => (a.id === res.account.id ? res.account : a)) } : s,
    );
    setToast({ text: `${won(amount)} 입금 완료` });
  }

  const watchRows: Row[] = UNIVERSE.filter(
    (a) => state.watchlist.includes(a.id) || holdings.has(a.id),
  ).map((a) => {
    const q = liveQuotes.get(a.id);
    const p = priceKrw(a.id);
    const h = holdings.get(a.id);
    const cost = h ? h.avgCostKrw * h.quantity : 0;
    const pnl = h && p != null ? p * h.quantity - cost : null;
    return {
      asset: a,
      quote: q,
      priceKrw: p,
      holding: h,
      pnlKrw: pnl,
      pnlPct: pnl != null && cost > 0 ? (pnl / cost) * 100 : null,
    };
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            ISA Lab <span className="text-muted">· 통합 모의투자</span>
          </h1>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            국내주식 · 국내상장 ETF · 해외주식 · 코인을 한 화면에서 굴리고, <Term k="ISA">ISA가</Term> 실제로 얼마를
            아껴주는지 계산합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <ConfirmButton
            label="초기화"
            confirmLabel="정말 지울까요?"
            onConfirm={() => {
              setState(initialState());
              setToast({ text: "모든 매매 기록을 지웠습니다." });
            }}
          />
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px] text-muted hover:bg-panel2"
          >
            수수료·세율
          </button>
          <button
            onClick={() => void refresh()}
            className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12px] hover:bg-panel2"
          >
            {loadingQuotes ? "조회 중…" : "새로고침"}
          </button>
        </div>
      </header>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {(failures.length > 0 || fx.rate == null) && tab !== "start" && (
        <div className="mb-4 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] leading-relaxed text-warn">
          {failures.length > 0 && (
            <p>
              일부 시세를 못 가져왔습니다 —{" "}
              {failures
                .map((f) => `${ASSET_MAP.get(f.instrumentId)?.name ?? f.instrumentId}(${f.reason})`)
                .join(", ")}
            </p>
          )}
          {fx.rate == null && <p>환율을 못 가져와 해외자산 주문이 막혀 있습니다.</p>}
        </div>
      )}

      {tab === "start" && <GettingStarted />}

      {tab === "research" && (
        <Research quotes={liveQuotes} priceKrw={priceKrw} holdings={holdings} />
      )}

      {tab === "history" && (
        <TradeHistory
          trades={state.trades.filter((t) => t.accountId === account.id)}
          feesKrw={metrics.feesKrw}
        />
      )}

      {tab === "dashboard" && (
        <>
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
                        a.id === accountId
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-line text-muted hover:bg-panel2"
                      }`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="총 자산" value={won(metrics.totalAssetsKrw)} />
                <Stat label={<Term k="예수금">예수금</Term>} value={won(metrics.cashKrw)} />
                <Stat
                  label={<Term k="평가손익">평가손익</Term>}
                  value={won(metrics.unrealizedKrw)}
                  sub={metrics.unrealizedPct == null ? undefined : pct(metrics.unrealizedPct)}
                  tone={metrics.unrealizedKrw > 0 ? "up" : metrics.unrealizedKrw < 0 ? "down" : undefined}
                />
                <Stat
                  label="세후 손익"
                  value={won(metrics.netAfterTaxKrw)}
                  sub={`실현 ${won(metrics.realizedKrw)} · 세금 ${won(metrics.estimatedTaxKrw)}`}
                  tone={metrics.netAfterTaxKrw > 0 ? "up" : metrics.netAfterTaxKrw < 0 ? "down" : undefined}
                />
              </div>

              {metrics.missingQuotes > 0 && (
                <p className="mt-2 text-[11px] text-warn">
                  보유 {metrics.missingQuotes}종목의 시세를 못 받아 위 합계에서 빠져 있습니다.
                </p>
              )}

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

              {metrics.byKind.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] text-muted">자산 구성</p>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-panel2">
                    {metrics.byKind.map((b, i) => (
                      <div
                        key={b.kind}
                        title={`${KIND_LABEL[b.kind]} ${b.weight.toFixed(1)}%`}
                        style={{ width: `${b.weight}%` }}
                        className={
                          ["bg-accent", "bg-emerald-500", "bg-amber-500", "bg-sky-500", "bg-rose-500"][i % 5]
                        }
                      />
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                    {metrics.byKind.map((b) => (
                      <span key={b.kind}>
                        {KIND_LABEL[b.kind]} {b.weight.toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <Panel title={isIsa(account.type) ? "ISA 한도·의무보유" : "계좌 안내"}>
              {contribution && holdStatus ? (
                <div className="space-y-3">
                  <Meter
                    label={<Term k="납입한도">{YEAR}년 납입 한도</Term>}
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
                    <p className="mt-1 flex flex-wrap items-center gap-1">
                      <Term k="의무보유기간">의무보유</Term>
                      {holdStatus.satisfied ? (
                        <span className="text-text">충족</span>
                      ) : (
                        <span className="text-warn">{holdStatus.monthsLeft}개월 남음</span>
                      )}
                      · 못 채우고 인출하면 혜택이 사라집니다
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-muted">
                  일반 위탁계좌는 <Term k="납입한도">납입한도가</Term> 없습니다. 대신{" "}
                  <Term k="국내상장 해외 ETF">국내상장 해외 ETF의</Term> 매매차익이
                  <Term k="배당소득">배당소득으로</Term> 과세되고 <Term k="손익통산">손익통산이</Term> 되지 않습니다. ISA 탭으로 바꿔 같은 매매의 세금을 비교해
                  보세요.
                </p>
              )}
            </Panel>
          </div>

          {fiWarn.level !== "none" && (
            <div
              className={`mb-4 rounded-lg border px-3 py-2 text-[12px] leading-relaxed ${
                fiWarn.level === "over"
                  ? "border-up/40 bg-up/10 text-up"
                  : "border-warn/40 bg-warn/10 text-warn"
              }`}
            >
              <b>
                <Term k="금융소득종합과세" /> — 올해 배당소득 {won(fiWarn.amount)}
              </b>
              <p className="mt-0.5">{fiWarn.message}</p>
            </div>
          )}

          {overseasRealized > 0 && !isIsa(account.type) && (
            <div className="mb-4 rounded-lg border border-line bg-panel2 px-3 py-2 text-[12px] leading-relaxed text-muted">
              해외주식 실현이익이 {won(overseasRealized)} 있습니다. 해외주식 <Term k="양도소득">양도소득은</Term> 원천징수가
              되지 않아 <b>다음 해 5월에 직접 신고·납부</b>해야 합니다.
            </div>
          )}

          <Watchlist
            rows={watchRows}
            watchlist={state.watchlist}
            hasTrades={state.trades.length > 0}
            streamStatus={streamStatus}
            onAdd={(id) =>
              setState((s2) => (s2 ? { ...s2, watchlist: [...new Set([...s2.watchlist, id])] } : s2))
            }
            onRemove={(id) =>
              setState((s2) => (s2 ? { ...s2, watchlist: s2.watchlist.filter((x) => x !== id) } : s2))
            }
            onOrder={(asset, side) => setOrder({ asset, side })}
          />

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
              {YEAR}년 <Term k="실현손익">실현손익</Term> {realizedRows.length}건 기준. 매도해야 실현손익이 잡힙니다.
            </p>
          </Panel>
        </>
      )}

      <footer className="mt-6 rounded-lg border border-line bg-panel2 p-3 text-[11px] leading-relaxed text-muted">
        <p>{DISCLAIMER}</p>
        <p className="mt-1">
          시세 출처 — 국내·해외주식 Yahoo Finance, 가상자산 Upbit 공개 API, 환율 Yahoo Finance. 실거래 계좌와
          연결되지 않으며 모든 주문은 가상입니다. 장 마감 시간에는 마지막 거래일 종가가 표시됩니다.
        </p>
      </footer>

      {showSettings && (
        <Settings
          fees={state.fees}
          rules={rules}
          onChangeFees={(f) => setState((s2) => (s2 ? { ...s2, fees: f } : s2))}
          onClose={() => setShowSettings(false)}
        />
      )}

      {order && (
        <OrderDialog
          intent={order}
          priceKrw={priceKrw(order.asset.id)}
          displayPrice={liveQuotes.get(order.asset.id)?.price ?? null}
          currency={order.asset.currency}
          cashKrw={account.cashKrw}
          holding={holdings.get(order.asset.id) ?? null}
          rules={rules}
          fees={state.fees}
          onClose={() => setOrder(null)}
          onSubmit={submitOrder}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg border px-3 py-2 text-[12px] shadow-lg ${
            toast.bad ? "border-up/40 bg-up/15 text-up" : "border-line bg-panel text-text"
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}
