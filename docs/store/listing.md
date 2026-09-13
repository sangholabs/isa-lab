# 덜내 스토어 등록 정보 (초안)

스토어에 올리기 전까지 여기서 고친다. 글자 수 제한은 각 칸 옆에 적었다. 문구 원칙: **계산기로 소개한다.** 「추천」「가입하세요」「수익」 같은 권유·약속 표현은 쓰지 않는다 (App Store 5.1.1(ix)·Google Play 금융 서비스 정책 오해 방지).

## 공통

| 칸 | 값 |
|---|---|
| 앱 이름 (App Store 30자) | 덜내: ISA 절세 계산기 |
| 홈 화면 이름 | 덜내 (`apps/mobile/app.json`) |
| 부제 (App Store 30자) | 일반계좌와 ISA 세금 비교 |
| Play 간단한 설명 (80자) | 올해 실현손익을 넣으면 일반계좌와 ISA의 세금 차이를 계산해 주는 오프라인 계산기 |
| 카테고리 | 금융 (보조: 유틸리티) |
| 개인정보처리방침 URL | https://isa-lab.vercel.app/privacy |
| 지원 URL | https://github.com/sangholabs/isa-lab/issues |
| 마케팅 URL (선택) | https://isa-lab.vercel.app |
| 저작권 | 2026 〈법적 이름〉 |
| 판매 국가 | 대한민국만 (EU 미판매 → DSA 판매자 정보 공개 대상 아님) |

## 설명 (4,000자)

올해 주식·ETF·코인에서 실현한 손익을 자산군별로 넣으면, 같은 매매를 일반계좌와 ISA(중개형)로 했을 때 세금이 얼마인지 나란히 계산합니다.

자산군마다 세금이 다릅니다. 국내주식 매매차익은 비과세지만, 국내상장 해외·채권 ETF의 매매차익은 배당소득으로 과세되고 손실과 통산되지 않습니다. 해외주식은 양도소득세, 가상자산은 과세 시작 연도에 따라 달라집니다. 덜내는 이 차이를 항목별로 풀어 보여 줍니다.

■ 이런 걸 계산합니다
- 자산군 5가지의 이익·손실을 만원 단위로 입력
- 일반계좌와 ISA(일반형·서민형)의 세금, 그리고 둘의 차이
- 항목별 과세표준·세율·세금과 계산에 쓴 가정
- ISA에 담을 수 없는 해외주식·가상자산은 따로 계산해 비교에서 제외
- 의무보유 기간을 못 채우는 경우와 정산 연도에 따른 차이

■ 근거를 함께 보여 줍니다
적용한 세율·한도마다 확정 여부와 설명을 붙였고, 출처 링크와 자료 확인일을 표시합니다.

■ 개인정보를 수집하지 않습니다
회원가입·로그인·서버가 없습니다. 입력값은 휴대폰 안에만 저장되고 어디로도 전송되지 않습니다.

■ 알려드립니다
공개 자료를 정리해 계산하는 도구이며 세무 검토를 받은 것이 아닙니다. 투자 권유가 아니며, 실제 신고·납부는 국세청과 증권사 기준을 따르세요.

## 키워드 (App Store 100자, 쉼표로 구분·띄어쓰기 없이)

ISA,중개형ISA,절세,세금계산기,배당소득세,양도소득세,해외ETF,서민형ISA,실현손익,세금비교

## 스크린샷

| 파일 | 화면 | 캡션 |
|---|---|---|
| `screenshots/1-result.jpg` | 결과 (예시) | 같은 매매, 계좌에 따라 달라지는 세금 |
| `screenshots/2-input.jpg` | 입력 | 자산군별 이익·손실을 만원 단위로 |
| `screenshots/3-sources.jpg` | 근거 | 세율마다 확정 여부와 출처 |
| `screenshots/4-settings.jpg` | 설정 | ISA 유형·정산 연도·의무보유 |

- **App Store**: 6.9인치 세로 1320×2868 (iPhone 17 Pro Max 시뮬레이터). 알파 없는 PNG
- **Google Play**: 긴 변이 짧은 변의 2배를 넘을 수 없다. 6.9인치 원본을 1434×2868로 여백을 붙여 쓴다 (`sips -p 2868 1434 --padColor F7F7F5`)
- **Play 그래픽**: `docs/store/feature-graphic.png` 1024×500 · 아이콘 `docs/store/play-icon-512.png`
- 위 파일은 로컬 릴리스 빌드(iPhone 17 Pro Max 시뮬레이터, 상태 표시줄 9:41 고정)에서 찍었다. Expo Go로 찍으면 개발자 버튼이 화면에 겹친다

## 심사·설문 답변

**App Store Connect**
- 앱 개인정보: 「데이터를 수집하지 않음」
- 연령 등급 설문: 모든 항목 「없음/아니요」 → 4+. 앱 안 웹 브라우저가 없고 링크는 기본 브라우저로 열리므로 무제한 웹 접근 아님
- 수출 규정: `ITSAppUsesNonExemptEncryption = false` (app.json)라 질문 없음
- 심사 메모 (영문):

> Deolnae is an offline tax calculator for Korean investors. The user enters realized gains and losses per asset class, and the app compares the tax in a regular brokerage account with an ISA (Individual Savings Account) using published Korean tax rules. There is no account, no login, no network access, and no financial service: the app does not trade, hold money, give advice, or connect to any institution. All calculations run on the device, and inputs are stored only on the device. Each rate is shown with its source and verification date on the "근거" (Sources) screen. To see a result quickly, tap "예시로 보기" (Show example).

**Google Play Console**
- 데이터 보안: 수집·공유하는 데이터 없음
- 금융 기능 선언: 「금융 기능을 제공하지 않음」
- 콘텐츠 등급(IARC): 폭력·도박·사용자 생성 콘텐츠·광고 없음
- 타깃 연령: 18세 이상 (가족 정책 대상 아님)
- 광고: 없음 · 앱 접근: 로그인 없이 모든 기능 사용 가능
- 첫 업로드는 비공개 테스트(closed, alpha) 트랙. 내부 테스트 트랙은 「테스터 12명 × 14일」 요건에 포함되지 않는다
