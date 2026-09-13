# ADR-0002 · npm workspaces로 엔진을 공유 패키지로 뺀다 (루트는 웹 그대로)

- 상태: 채택 · 2026-09-13

## 배경
웹(Next.js)과 앱(Expo)이 같은 세금 엔진을 써야 한다. 복사하면 두 벌이 갈라진다.

## 결정
`src/lib/tax` → `packages/tax-engine`(`@isa-lab/tax-engine`)로 옮기고, 루트 `package.json`에 `workspaces: ["apps/*", "packages/*"]`를 둔다. **Next.js 앱은 루트에 그대로** 둔다(옮기지 않는다).

## 이유
- 이미 npm(package-lock)을 쓰고 있어 pnpm·turbo 같은 도구를 추가하지 않는다
- 웹을 `apps/web`으로 옮기면 Vercel 설정·README 링크·CI 경로가 전부 바뀐다. 루트를 유지하면 바뀌는 건 import 경로뿐
- 엔진 패키지는 빌드 없이 소스(.ts)를 그대로 소비한다 — Next는 `transpilePackages`, Metro는 기본으로 워크스페이스를 트랜스파일한다

## 결과
- 웹 import: `@/lib/tax/*` → `@isa-lab/tax-engine/*` (13파일)
- 테스트는 루트 `tests/`에 그대로, vitest alias로 패키지를 가리킨다. 59개 통과 확인
- `tsconfig.json`은 `apps/`를 제외한다(RN 타입과 섞이지 않게)
