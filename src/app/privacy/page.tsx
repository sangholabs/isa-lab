import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "덜내 개인정보처리방침 · ISA Lab",
  description: "덜내(ISA 절세 계산기) 앱은 개인정보를 수집하지 않고 서버로 아무것도 보내지 않습니다.",
};

const EFFECTIVE = "2026-09-14";
const SUPPORT = "https://github.com/sangholabs/isa-lab/issues";
const OPERATOR = "sangholabs";

/** 스토어 두 곳이 요구하는 방침 페이지. 앱이 수집하는 것이 없다는 사실을 그대로 적는다 (ADR-0003). */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-sm leading-relaxed">
      <h1 className="text-xl font-semibold tracking-tight">덜내 개인정보처리방침</h1>
      <p className="mt-1 text-muted">시행일 {EFFECTIVE}</p>

      <Section title="요약">덜내 앱은 개인정보를 수집하지 않고, 입력한 내용을 어디로도 보내지 않습니다.</Section>
      <Section title="적용 범위">이 방침은 iOS·Android용 「덜내」(ISA 절세 계산기) 앱에 적용됩니다.</Section>
      <Section title="수집하는 정보">
        <p>없습니다. 회원가입과 로그인이 없고, 이름·연락처·기기 식별자·위치·광고 식별자를 받지 않습니다.</p>
        <p>분석, 광고, 오류 수집 도구를 넣지 않았고 서버와 통신하지 않습니다.</p>
      </Section>
      <Section title="기기 안에만 저장되는 정보">
        <p>
          다음 실행 때 다시 보여 주기 위해, 입력한 자산군별 이익·손실 금액과 설정(ISA 유형, 정산 연도, 의무보유 여부 등)을 휴대폰
          안에만 저장합니다. 앱은 이 정보를 개발자나 어떤 서버로도 보내지 않습니다.
        </p>
        <p>앱의 「지우기」로 입력값을 지울 수 있고, 앱을 삭제하면 기기에 저장된 내용도 지워집니다.</p>
        <p>다만 휴대폰의 백업 기능(iCloud, Google 백업)을 켜 두셨다면 이 내용이 백업에 함께 담길 수 있고, 앱을 다시 설치할 때 복원될 수 있습니다.</p>
      </Section>
      <Section title="제3자 제공과 처리 위탁">없습니다.</Section>
      <Section title="외부 링크">
        근거 화면과 설정의 링크는 휴대폰의 기본 브라우저로 열립니다. 열린 사이트에서의 정보 처리는 그 사이트의 방침을 따릅니다.
      </Section>
      <Section title="운영자와 문의">
        운영자는 {OPERATOR}입니다. 문의는{" "}
        <a className="text-accent underline underline-offset-2" href={SUPPORT}>
          GitHub Issues
        </a>
        에 남겨 주세요.
      </Section>
      <Section title="변경">
        방침이 바뀌면 이 페이지와 시행일을 고칩니다. 앞으로 정보를 수집하게 되면 그 버전을 내기 전에 이 페이지에 먼저 알립니다.
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-1.5 space-y-1.5 text-muted">{children}</div>
    </section>
  );
}
