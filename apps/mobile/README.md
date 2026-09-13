# 덜내 — ISA 절세 계산기 (모바일)

ISA Lab 웹의 「세금 비교」만 떼어낸 앱. 올해 실현손익을 자산군별로 넣으면 일반계좌와 ISA의 세금을 나란히 보여준다.
계산은 웹과 **같은 엔진**(`packages/tax-engine`)을 기기 안에서 돌린다 — 서버·로그인 없음, 입력값은 기기에만 저장.

## 실행 (맥)

```bash
# 저장소 루트에서 — npm workspaces라 루트에서 한 번만
npm install
# Expo가 SDK에 맞는 버전으로 골라 설치한다
npm --workspace apps/mobile exec -- npx expo install react-native-safe-area-context @react-native-async-storage/async-storage
# 실행 — 폰의 Expo Go 앱으로 QR 스캔, 또는 i(iOS 시뮬레이터) / a(Android)
npm run mobile
```

## 화면
입력(자산군 5 × 이익/손실, 만원) → 결과(절세액 · 일반 vs ISA · 항목별 · 룰셋 토글) → 근거(룰셋 · 출처 · 고지) · 설정(ISA 유형 · 연도 · 룰셋 · 의무보유)

## 구조
- `App.tsx` — 화면 3개 + 설정 모달. 라우터 없음(화면이 셋이라 상태 하나로 충분)
- `src/state.ts` — 입력 상태·예시 데이터 · `src/compute.ts` — 엔진 호출 · `src/format.ts` — 원·만원·% 표기
- 세금 계산은 전부 `@isa-lab/tax-engine`. 앱에는 세율이 한 줄도 없다
