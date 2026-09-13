# 덜내 — ISA 절세 계산기 (모바일)

ISA Lab 웹의 「세금 비교」만 떼어낸 앱. 올해 실현손익을 자산군별로 넣으면 일반계좌와 ISA의 세금을 나란히 보여준다.
계산은 웹과 **같은 엔진**(`packages/tax-engine`)을 기기 안에서 돌린다 — 서버·로그인 없음, 입력값은 기기에만 저장.

## 실행 (맥)

저장소 루트에서 (npm workspaces — 루트에서 한 번만). 줄 끝에 주석을 붙이지 말 것 — zsh는 `#` 뒤를 인자로 넘긴다.

```bash
npm install
npm test
npm run mobile
```

`npm run mobile` 뒤 터미널의 QR을 폰 **Expo Go** 앱으로 찍는다(폰과 맥이 같은 Wi-Fi). iOS 시뮬레이터는 `i`, Android는 `a`(각각 Xcode·Android Studio 필요).

폰 없이 번들만 확인하려면 `npm --workspace apps/mobile exec -- npx expo export --platform ios --output-dir /tmp/deolnae-export` — Metro가 끝까지 묶이면 import·워크스페이스 해석은 통과한 것이다.

**앱 이름 바꾸기**: `app.json`의 `"name"` 한 줄. 언제든 바꿀 수 있다. `bundleIdentifier`/`package`(`app.deolnae`)는 **첫 스토어 업로드 전까지만** 바꿀 수 있다.

## 화면
입력(자산군 5 × 이익/손실, 만원) → 결과(절세액 · 일반 vs ISA · 항목별 · 룰셋 토글) → 근거(룰셋 · 출처 · 고지) · 설정(ISA 유형 · 연도 · 룰셋 · 의무보유)

## 구조
- `App.tsx` — 화면 3개 + 설정 모달. 라우터 없음(화면이 셋이라 상태 하나로 충분)
- `src/state.ts` — 입력 상태·예시 데이터 · `src/compute.ts` — 엔진 호출 · `src/format.ts` — 원·만원·% 표기
- 세금 계산은 전부 `@isa-lab/tax-engine`. 앱에는 세율이 한 줄도 없다(힌트 문구도 룰셋에서 읽는다)
- 이익·손실은 합치지 않고 두 행으로 엔진에 넘긴다 — [ADR-0004](../../docs/adr/0004-mobile-input-gain-loss-rows.md) · 테스트는 루트 `tests/mobile.test.ts`
