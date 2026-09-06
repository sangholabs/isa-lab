"use client";

import { useMemo, useState } from "react";
import { Badge, Modal, Term } from "./ui";
import { num, won } from "@/lib/format";
import { KIND_LABEL, KIND_TAX_HINT } from "@/lib/universe";
import { computeTradeCost } from "@/lib/tax/engine";
import type { TaxRuleSet } from "@/lib/tax/rules";
import type { Asset, FeeSettings, Holding } from "@/lib/portfolio/types";

export interface OrderIntent {
  asset: Asset;
  side: "buy" | "sell";
}

export function OrderDialog({
  intent,
  priceKrw,
  displayPrice,
  currency,
  cashKrw,
  holding,
  rules,
  fees,
  onClose,
  onSubmit,
}: {
  intent: OrderIntent;
  priceKrw: number | null;
  displayPrice: number | null;
  currency: "KRW" | "USD";
  cashKrw: number;
  holding: Holding | null;
  rules: TaxRuleSet;
  fees: FeeSettings;
  onClose: () => void;
  onSubmit: (quantity: number) => void;
}) {
  const { asset, side } = intent;
  const isCrypto = asset.kind === "crypto";
  const step = isCrypto ? 0.0001 : 1;
  const [mode, setMode] = useState<"qty" | "amount">("qty");
  const [qtyText, setQtyText] = useState(isCrypto ? "0.01" : "1");
  const [amountText, setAmountText] = useState("1000000");

  const quantity = useMemo(() => {
    if (priceKrw == null || priceKrw <= 0) return 0;
    if (mode === "qty") {
      const v = Number(qtyText.replace(/,/g, ""));
      return Number.isFinite(v) && v > 0 ? v : 0;
    }
    const amount = Number(amountText.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const raw = amount / priceKrw;
    return isCrypto ? Math.floor(raw / step) * step : Math.floor(raw);
  }, [mode, qtyText, amountText, priceKrw, isCrypto, step]);

  const notionalKrw = priceKrw != null ? priceKrw * quantity : 0;
  const cost = useMemo(
    () =>
      computeTradeCost({
        kind: asset.kind,
        side,
        notional: notionalKrw,
        krMarket: asset.krMarket,
        fees,
        rules,
      }),
    [asset.kind, asset.krMarket, side, notionalKrw, rules, fees],
  );

  const needKrw = side === "buy" ? notionalKrw + cost.total : 0;
  const proceedsKrw = side === "sell" ? notionalKrw - cost.total : 0;
  const maxQty =
    side === "buy"
      ? priceKrw && priceKrw > 0
        ? (() => {
            const load =
              1 +
              (isCrypto
                ? fees.cryptoFeeRate
                : asset.kind === "overseas_stock"
                  ? fees.overseasBrokerFeeRate + fees.fxSpreadRate
                  : fees.krBrokerFeeRate);
            const raw = cashKrw / (priceKrw * load);
            return isCrypto ? Math.floor(raw / step) * step : Math.floor(raw);
          })()
        : 0
      : (holding?.quantity ?? 0);

  const problem =
    priceKrw == null
      ? "시세를 아직 받지 못했습니다"
      : quantity <= 0
        ? "수량이 0입니다"
        : side === "buy" && needKrw > cashKrw
          ? `예수금이 ${won(needKrw - cashKrw)} 모자랍니다`
          : side === "sell" && quantity > (holding?.quantity ?? 0) + 1e-9
            ? `보유 수량(${num(holding?.quantity ?? 0)})을 넘습니다`
            : null;

  const realizedPreview =
    side === "sell" && holding && priceKrw != null
      ? proceedsKrw - holding.avgCostKrw * quantity
      : null;

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {asset.name}
          <Badge tone={side === "buy" ? "up" : "down"}>{side === "buy" ? "매수" : "매도"}</Badge>
        </span>
      }
      onClose={onClose}
    >
      <div className="mb-3 rounded-lg border border-line bg-panel2 p-3 text-[12px]">
        <div className="flex justify-between">
          <span className="text-muted">{KIND_LABEL[asset.kind]}</span>
          <span className="tabular-nums">
            {displayPrice == null
              ? "—"
              : currency === "USD"
                ? `$${num(displayPrice, 2)}`
                : won(displayPrice)}
          </span>
        </div>
        {currency === "USD" && priceKrw != null && (
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>원화 환산</span>
            <span className="tabular-nums">{won(priceKrw)}</span>
          </div>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-muted">{KIND_TAX_HINT[asset.kind]}</p>
      </div>

      <div className="mb-3 flex gap-1 rounded-lg border border-line bg-panel2 p-1">
        {(
          [
            { id: "qty", label: "수량으로" },
            { id: "amount", label: "금액으로" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[12px] transition ${
              mode === m.id ? "bg-accent/15 text-accent" : "text-muted hover:bg-panel"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "qty" ? (
        <div>
          <label className="mb-1 block text-[11px] text-muted">수량</label>
          <input
            inputMode="decimal"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value)}
            className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm tabular-nums outline-none focus:border-accent"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {[0.25, 0.5, 1].map((r) => (
              <button
                key={r}
                onClick={() => {
                  const v = maxQty * r;
                  setQtyText(isCrypto ? v.toFixed(4) : String(Math.floor(v)));
                }}
                className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:bg-panel2"
              >
                {side === "buy" ? "가능 수량" : "보유"} {r * 100}%
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-[11px] text-muted">금액 (원)</label>
          <input
            inputMode="numeric"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className="w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm tabular-nums outline-none focus:border-accent"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {[100_000, 500_000, 1_000_000, 5_000_000].map((v) => (
              <button
                key={v}
                onClick={() => setAmountText(String(v))}
                className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:bg-panel2"
              >
                {v >= 10_000 ? `${v / 10_000}만` : v}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {isCrypto ? "소수점 넷째 자리까지" : "1주 단위로"} 내림해서 {num(quantity)} 만큼 주문합니다.
          </p>
        </div>
      )}

      <div className="mt-4 space-y-1.5 rounded-lg border border-line bg-panel2 p-3 text-[12px]">
        <Row label="주문 수량" value={num(quantity)} />
        <Row label="주문 금액" value={won(notionalKrw)} />
        <Row
          label={<Term k="증권거래세">수수료 · 세금</Term>}
          value={won(cost.total)}
          sub={cost.notes.join(" · ") || undefined}
        />
        <div className="my-1 border-t border-line" />
        {side === "buy" ? (
          <>
            <Row label="필요 금액" value={won(needKrw)} strong />
            <Row label="주문 후 예수금" value={won(cashKrw - needKrw)} />
          </>
        ) : (
          <>
            <Row label="받는 금액" value={won(proceedsKrw)} strong />
            {realizedPreview != null && (
              <Row
                label={<Term k="실현손익">이번 매도 실현손익</Term>}
                value={won(realizedPreview)}
                tone={realizedPreview > 0 ? "up" : realizedPreview < 0 ? "down" : undefined}
              />
            )}
          </>
        )}
      </div>

      {problem && (
        <p className="mt-3 rounded-lg border border-up/40 bg-up/10 px-3 py-2 text-[12px] text-up">{problem}</p>
      )}

      <button
        disabled={!!problem}
        onClick={() => onSubmit(quantity)}
        className={`mt-4 w-full rounded-lg border px-3 py-2.5 text-sm font-medium transition disabled:opacity-30 ${
          side === "buy"
            ? "border-up/50 bg-up/15 text-up hover:bg-up/25"
            : "border-down/50 bg-down/15 text-down hover:bg-down/25"
        }`}
      >
        {side === "buy" ? "매수 주문" : "매도 주문"}
      </button>
      <p className="mt-2 text-center text-[11px] text-muted">
        가상 주문입니다. 실제 계좌와 연결되지 않습니다.
      </p>
    </Modal>
  );
}

function Row({
  label,
  value,
  sub,
  strong,
  tone,
}: {
  label: React.ReactNode;
  value: string;
  sub?: string;
  strong?: boolean;
  tone?: "up" | "down";
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1 text-muted">{label}</span>
      <span className="text-right">
        <span
          className={`tabular-nums ${strong ? "font-semibold" : ""} ${
            tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""
          }`}
        >
          {value}
        </span>
        {sub && <span className="block text-[11px] text-muted">{sub}</span>}
      </span>
    </div>
  );
}
