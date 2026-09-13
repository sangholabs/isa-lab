# ADR-0001 · 모바일 앱은 React Native(Expo)로 만든다

- 상태: 채택 · 2026-09-13
- 결정자: SH

## 배경
ISA Lab을 스토어에 올라간 앱으로도 제공한다. 후보는 Flutter와 React Native. 웹은 이미 Next.js(TypeScript)이고, 세금 엔진은 TypeScript 모듈이다.

## 결정
React Native + Expo(TypeScript). 앱은 웹과 **같은 세금 엔진 소스**를 import한다.

## 이유
- 엔진이 TS라 Dart로 세 번째 이식을 하지 않아도 된다(이미 Java 이식이 하나 있다). 테스트 59개가 웹·앱을 동시에 지킨다
- EAS Build/Submit으로 iOS·Android 빌드·서명·제출을 한 곳에서 한다. EAS Update로 JS 수정을 심사 없이 배포할 수 있다
- 국내 채용 공고 수는 RN ≥ Flutter (사람인 2026-09-13: 신입 44 vs 35)

## 대안과 버린 이유
- Flutter: 픽셀 일관성·커스텀 UI가 강점이지만 이 앱에 필요 없고, Dart 추가 학습과 엔진 재이식이 비용
- Flutter Web으로 웹까지: 캔버스 렌더링이라 SEO가 안 된다 — 웹의 존재 이유와 충돌

## 결과
- `apps/mobile`(Expo) · `packages/tax-engine`(공유) · 루트(Next.js)
- 나중에 Flutter 이력이 필요하면 화면 3개짜리 이 앱을 이식하는 것이 가장 싸다
