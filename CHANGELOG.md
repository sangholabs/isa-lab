# Changelog

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

## [Unreleased]

### Added
- `apps/mobile` — 덜내(ISA 절세 계산기) Expo 앱 골격: 입력·결과·근거 화면 + 설정 모달, 기기 저장 (#ADR-0001, #ADR-0003)
- `packages/tax-engine` — 세금 엔진을 웹·앱이 공유하는 워크스페이스 패키지로 분리 (#ADR-0002)
- `docs/adr/` · `docs/prd-mobile.md` · 이 CHANGELOG · PR 템플릿
- `.claude/settings.json` — ponytail 플러그인을 프로젝트 스코프로 설치 (새 세션에서 자동 활성)

### Changed
- 웹 import 경로 `@/lib/tax/*` → `@isa-lab/tax-engine/*` (동작 변경 없음, 테스트 59 통과)

## [0.1.0] — 2026-09-07
- 국내주식·ETF·해외주식·코인 통합 모의매매 · ISA 세금 비교 · 룰셋 2종 · 리서치(선택) — 웹 첫 공개
