"use client";

import { useEffect, useState } from "react";
import { Badge, Panel, Term } from "./ui";

const KEY = "isa-lab:onboarding:v1";

interface Step {
  id: string;
  title: string;
  body: React.ReactNode;
  links?: { label: string; href: string }[];
}

/**
 * 시작하기 탭.
 *
 * 제도는 바뀐다. 그래서 조건·한도 같은 변하는 숫자는 최소한만 적고,
 * 최종 확인은 공식 페이지로 보낸다. 여기서 다루는 건 "무엇을 먼저 하고
 * 무엇을 나중에 하는가"라는 순서다.
 */
const STEPS: Step[] = [
  {
    id: "know",
    title: "1. 여기서 무엇을 연습하는지 먼저 안다",
    body: (
      <>
        <p>
          이 사이트는 <b>가상 계좌</b>입니다. 실제 돈이 오가지 않고, 어떤 증권사·거래소와도 연결되지 않습니다.
          시세만 진짜입니다.
        </p>
        <p className="mt-2">
          연습할 것은 하나입니다 — <b>같은 종목을 사고팔아도 어느 계좌에 담느냐에 따라 세금이 달라진다</b>는 것.
          여기서 감을 잡고 나서 실제 계좌를 만드는 순서를 권합니다.
        </p>
      </>
    ),
  },
  {
    id: "demo",
    title: "2. 「데모 채우기」를 눌러 차이부터 본다",
    body: (
      <>
        <p>
          대시보드 오른쪽 위 <b>데모 채우기</b>를 누르면 매매 이력이 채워집니다. 계좌 탭을 일반 ↔ ISA로 바꿔가며
          「정산 비교」를 보세요.
        </p>
        <p className="mt-2">
          같은 매매인데 세금이 다릅니다. 이유는 하나입니다 —{" "}
          <Term k="국내상장 해외 ETF">국내상장 해외 ETF</Term>의 차익은{" "}
          <Term k="배당소득">배당소득</Term>이라 일반계좌에서는{" "}
          <Term k="손익통산">손익통산</Term>이 안 되기 때문입니다.
        </p>
      </>
    ),
  },
  {
    id: "broker",
    title: "3. 증권사 계좌를 만든다 (주식·ETF용)",
    body: (
      <>
        <p>주식과 ETF를 사려면 증권사 계좌가 필요합니다. 은행 계좌와 별개입니다.</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted">
          <li>증권사 앱을 깔고 비대면으로 만듭니다. 보통 5~10분입니다.</li>
          <li>준비물은 <b>신분증</b>과 <b>본인 명의 은행 계좌</b>입니다. 계좌는 1원 입금으로 확인합니다.</li>
          <li>만든 뒤 증권 계좌로 돈을 옮겨야 매수가 됩니다.</li>
        </ul>
        <p className="mt-2 text-muted">
          어느 증권사를 고를지는 수수료와 앱이 쓸 만한지로 봅니다. 이 시뮬레이터의 기본 수수료율은 온라인 위탁
          기준 0.015%로 잡아뒀습니다.
        </p>
      </>
    ),
  },
  {
    id: "isa",
    title: "4. ISA 계좌를 따로 만든다",
    body: (
      <>
        <p>
          <Term k="ISA">ISA</Term>는 일반 증권 계좌와 별개로 만듭니다. 직접 종목을 고르려면{" "}
          <Term k="중개형">중개형</Term>을 선택하세요.
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted">
          <li>만 19세 이상이면 만들 수 있습니다.</li>
          <li><b>1인 1계좌</b>입니다. 여러 금융사에 동시에 만들 수 없습니다.</li>
          <li>
            소득이 일정 수준 이하면 <b>서민형</b>으로 만들 수 있고 <Term k="비과세">비과세</Term> 한도가 더
            큽니다. 홈택스 소득확인증명서가 필요합니다.
          </li>
          <li>
            <Term k="의무보유기간">의무보유기간</Term>이 3년입니다. 만든 날부터 세는 것이니, 당장 넣을 돈이
            없더라도 <b>일찍 만들어 두는 것</b>이 유리합니다.
          </li>
        </ul>
        <p className="mt-2 rounded-md border border-warn/40 bg-warn/10 px-2.5 py-2 text-[12px] text-warn">
          ISA로는 해외 상장 주식과 코인을 직접 살 수 없습니다. 미국 지수에 투자하고 싶다면 국내에 상장된 해외
          ETF를 담습니다.
        </p>
      </>
    ),
    links: [
      { label: "금융투자협회 ISA 안내", href: "https://www.kofia.or.kr" },
      { label: "홈택스 (소득확인증명서)", href: "https://www.hometax.go.kr" },
    ],
  },
  {
    id: "crypto",
    title: "5. 코인을 하려면 거래소와 실명계좌가 따로 필요하다",
    body: (
      <>
        <p>
          <Term k="가상자산">가상자산</Term>은 증권사가 아니라 거래소에서 삽니다. 원화를 넣으려면 그 거래소가
          제휴한 은행의 <b>실명확인 입출금 계좌</b>가 있어야 합니다.
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted">
          <li>거래소 가입 → 본인확인(KYC) → 제휴 은행 계좌 연결 순서입니다.</li>
          <li>거래소마다 제휴 은행이 정해져 있습니다. 업비트는 케이뱅크입니다.</li>
          <li>첫 입금 후 일정 시간 동안 출금이 막히는 규칙이 있습니다. 거래소 공지를 확인하세요.</li>
        </ul>
      </>
    ),
    links: [{ label: "업비트 고객센터", href: "https://support.upbit.com/hc/ko" }],
  },
  {
    id: "first",
    title: "6. 첫 매수는 작게, 그리고 왜 샀는지 적어둔다",
    body: (
      <>
        <p>
          여기서 <b>금액으로</b> 주문을 넣어보세요. 10만원어치가 몇 주인지, 수수료가 얼마 빠지는지 주문창에서
          먼저 보입니다.
        </p>
        <p className="mt-2">
          <b>리서치</b> 탭에서 종목을 분석하면 강세·약세 논거가 함께 나옵니다. 한쪽만 읽고 사면 반대 논거가
          현실이 됐을 때 대응할 수 없습니다.
        </p>
        <p className="mt-2 text-muted">
          매도해야 <Term k="실현손익">실현손익</Term>이 잡히고, 세금은 실현손익에만 붙습니다. 평가손익이 아무리
          커도 팔기 전까지는 세금이 없습니다.
        </p>
      </>
    ),
  },
];

export function GettingStarted() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setDone(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* 저장이 막혀 있어도 화면은 돌아야 한다 */
    }
  }, []);

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  };

  const doneCount = STEPS.filter((s) => done[s.id]).length;

  return (
    <div className="space-y-4">
      <Panel
        title="시작하기"
        right={
          <Badge tone={doneCount === STEPS.length ? "live" : "neutral"}>
            {doneCount} / {STEPS.length} 완료
          </Badge>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          주식도 코인도 처음이라면 위에서부터 하나씩 따라 하면 됩니다. 3번부터는 실제 계좌를 만드는 이야기라,
          이 사이트에서 먼저 충분히 연습한 뒤에 해도 늦지 않습니다.
        </p>
      </Panel>

      {STEPS.map((s) => (
        <Panel key={s.id}>
          <div className="flex items-start gap-3">
            <button
              onClick={() => toggle(s.id)}
              aria-label={`${s.title} 완료 표시`}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] transition ${
                done[s.id]
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-line text-transparent hover:border-accent"
              }`}
            >
              ✓
            </button>
            <div className="min-w-0 flex-1">
              <h3 className={`text-sm font-medium ${done[s.id] ? "text-muted line-through" : ""}`}>
                {s.title}
              </h3>
              <div className="mt-2 space-y-1 text-[13px] leading-relaxed">{s.body}</div>
              {s.links && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-md border border-line px-2 py-1 text-[11px] text-muted transition hover:border-accent hover:text-accent"
                    >
                      {l.label} ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Panel>
      ))}

      <Panel title="용어가 막힐 때">
        <p className="text-[13px] leading-relaxed text-muted">
          화면 곳곳의 <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-line text-[9px]">?</span>{" "}
          를 누르면 그 자리에서 설명이 뜹니다. 예를 들어 —{" "}
          <Term k="손익통산" />, <Term k="분리과세" />, <Term k="증권거래세" />, <Term k="의무보유기간" />.
        </p>
      </Panel>

      <p className="px-1 text-[11px] leading-relaxed text-muted">
        여기 적힌 제도 설명은 공개 자료를 정리한 것이고 세무·법률 자문이 아닙니다. 가입 조건과 한도는 바뀔 수
        있으니 실제 개설 전에 해당 금융사와 공식 안내를 확인하세요.
      </p>
    </div>
  );
}
