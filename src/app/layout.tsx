import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ISA Lab · 국내주식·해외주식·코인 통합 모의투자",
  description:
    "ISA 계좌가 실제로 얼마를 아껴주는지 계산해주는 모의투자 시뮬레이터. 국내주식·국내상장 ETF·해외주식·가상자산을 한 화면에서 굴리고, 일반계좌와 세금을 비교합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
