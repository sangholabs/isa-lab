# ISA Lab — 작업 규칙

## 구조 (npm workspaces · 루트 = Next.js 웹)
- `src/` 웹 · `packages/tax-engine/` 세금 엔진(웹·앱 공유, 의존성 0) · `apps/mobile/` 덜내 앱(Expo) · `tests/` vitest 75
- 명령: `npm install`(루트 한 번) · `npm test` · `npm run dev`(웹) · `npm run mobile`(앱)

## 절대 규칙
- **세율·한도 숫자는 `packages/tax-engine/src/rules.ts`에만.** 화면·앱 코드에 세율을 쓰지 않는다. 바꾸면 `VERIFIED_AT`과 출처를 같이 갱신
- 엔진 변경은 `tests/tax.test.ts`에 케이스를 먼저 쓴다 (거부·경계 케이스부터)
- 앱 1차는 서버·로그인·네트워크 없음 (ADR-0003). 추가하려면 ADR부터
- 설계 결정은 `docs/adr/NNNN-*.md` (배경·결정·이유·대안·결과). 변경은 `CHANGELOG.md` Unreleased에 한 줄
- 커밋 메시지는 한국어 한 줄로 "무엇을 왜" — 기존 로그 톤 유지

## Ponytail — 코드 쓰기 전 7단
1. 이거 진짜 필요해? → 2. 이미 있어?(엔진·웹 컴포넌트) → 3. 표준 라이브러리/RN 기본 컴포넌트로 돼? → 4. 언어 기본 기능? → 5. 깔린 의존성에 있어? → 6. 한 줄로 돼? → 7. 그제야 최소 구현
- 통과 결과 예: 라우터 X(화면 3개) · UI 라이브러리 X · 상태관리 라이브러리 X · 서버 X · pnpm/turbo X
- ponytail 플러그인은 **프로젝트 스코프**로 설치돼 있다(`.claude/settings.json` → 새 세션에서 자동 활성, 기본 full). 레벨 전환 `/ponytail lite|full|ultra` · PR 전 `/ponytail-review`. 데스크톱 앱에는 `/plugin` 명령이 없으니 재설치는 터미널에서 `claude plugin install ponytail@ponytail --scope project`. 이 파일의 사다리는 플러그인이 없는 세션용

## 하지 않는 것
- `node_modules`를 리눅스 VM에서 설치하지 않는다(맥에서만) · 파일 삭제는 SH가
- 웹을 `apps/web`으로 옮기지 않는다 (ADR-0002)
