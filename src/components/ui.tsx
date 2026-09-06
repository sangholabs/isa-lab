"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { GLOSSARY } from "@/lib/glossary";

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-panel ${className}`}>
      {(title || right) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  neutral: "border-line text-muted",
  warn: "border-warn/40 text-warn bg-warn/10",
  accent: "border-accent/40 text-accent bg-accent/10",
  up: "border-up/40 text-up bg-up/10",
  down: "border-down/40 text-down bg-down/10",
  live: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
};

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-none ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** 용어 옆에 붙는 물음표. 모르는 말이 나오면 그 자리에서 풀린다. */
export function Term({ children, k }: { children?: ReactNode; k: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const text = GLOSSARY[k];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!text) return <>{children ?? k}</>;

  return (
    <span ref={ref} className="relative inline-flex items-center gap-0.5">
      <span>{children ?? k}</span>
      <button
        type="button"
        aria-label={`${k} 설명`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-line text-[9px] leading-none text-muted transition hover:border-accent hover:text-accent"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-1.5 w-72 rounded-lg border border-line bg-panel2 p-2.5 text-[12px] font-normal leading-relaxed text-text shadow-xl"
        >
          <b className="mb-1 block text-accent">{k}</b>
          {text}
        </span>
      )}
    </span>
  );
}

export function Meter({
  value,
  max,
  label,
  sub,
}: {
  value: number;
  max: number;
  label: ReactNode;
  sub?: string;
}) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-[11px] text-muted">
        <span className="flex items-center gap-1">{label}</span>
        <span className="tabular-nums">{(ratio * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${ratio * 100}%` }} />
      </div>
      {sub && <p className="mt-1 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm leading-relaxed text-muted">{children}</p>;
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-panel sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:bg-panel2"
          >
            닫기
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/** 되돌릴 수 없는 동작은 한 번 더 묻는다 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = "",
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else {
          setArmed(true);
        }
      }}
      className={`rounded-lg border px-2.5 py-1.5 text-[12px] transition ${
        armed ? "border-up/50 bg-up/15 text-up" : "border-line bg-panel text-muted hover:bg-panel2"
      } ${className}`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 rounded-lg border border-line bg-panel p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            title={t.hint}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] transition ${
              t.id === value ? "bg-accent/15 text-accent" : "text-muted hover:bg-panel2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: ReactNode;
  value: string;
  tone?: "up" | "down";
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel2 p-3">
      <p className="flex items-center gap-1 text-[11px] text-muted">{label}</p>
      <p
        className={`mt-1 text-base font-semibold tabular-nums ${
          tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] tabular-nums text-muted">{sub}</p>}
    </div>
  );
}
