# PointApp Builder completion tasks

Internal workflow state. Human-readable scope and decisions are in the adjacent dark-mode HTML artifacts.

## Phase 1 — Setup and contract gates

- [x] T001 Add pinned Hono, Miniflare, OpenAPI lint, and testing dependencies in `package.json` and `package-lock.json`
- [x] T002 Add contract, migration, performance, security, and full-check scripts in `package.json`
- [x] T003 Configure selective Worker-first API/auth/content/media routes and rate-limit bindings in `wrangler.jsonc`
- [x] T004 Add typed Worker bindings and local-only fixture variables in `worker-configuration.d.ts` and `.dev.vars.example`
- [x] T005 Add OpenAPI lint configuration in `redocly.yaml`
- [x] T006 Add coverage thresholds and test projects for unit/integration tests in `vite.config.ts`
- [x] T007 Add CI gates with Node 22, contract, migration, coverage, audit, build, and browser jobs in `.github/workflows/quality.yml`

## Phase 2 — Foundational security and persistence

- [x] T008 [P] Write request-security tests in `tests/unit/server/request-security.test.ts`
- [x] T009 [P] Write safe-error and correlation tests in `tests/unit/server/problems.test.ts`
- [x] T010 [P] Write canonical JSON/hash/signature tests in `tests/unit/content/canonical.test.ts`
- [x] T011 [P] Write migration-from-baseline tests in `tests/integration/migrations.test.ts`
- [x] T012 Create forward-only schema for memberships, drafts, revisions, media, releases, channels, audits, and idempotency in `migrations/0001_complete_builder.sql`
- [x] T013 Implement shared identifiers, timestamps, pagination, and bounded schemas in `src/domain/primitives.ts`
- [x] T014 Implement canonical JSON, SHA-256, base64url, and Ed25519 helpers in `src/content/crypto.ts`
- [x] T015 Implement RFC 9457-style safe problems and request correlation in `src/server/problems.ts`
- [x] T016 Implement exact-origin, body/content-type limits, security headers, and safe caching in `src/server/security.ts`
- [x] T017 Implement Cloudflare abuse-limit adapter with local deterministic fallback in `src/server/rate-limit.ts`
- [x] T018 Implement D1 query/result helpers and transactional batch composition in `src/server/d1.ts`
- [x] T019 Implement actor-scoped idempotency claims, replay, mismatch conflict, and expiry in `src/server/idempotency.ts`
- [x] T020 Implement append-only redacted audit service in `src/server/audit.ts`
- [x] T021 Compose Hono API, public routes, asset fallback, and centralized error handling in `src/server/app.ts` and `worker/index.ts`
- [x] T022 Verify Phase 2 with migration, unit, integration, and security-header suites via `npm run check:foundation`

## Phase 3 — US1 Bootstrap ownership and govern access (P1)

- [ ] T023 [P] [US1] Write OAuth state, PKCE, cookie, callback, replay, and expiry tests in `tests/unit/server/auth.test.ts`
- [ ] T024 [P] [US1] Write concurrent bootstrap and Pending Editor registration tests in `tests/integration/auth-bootstrap.test.ts`
- [ ] T025 [P] [US1] Write exhaustive role/status/capability matrix tests in `tests/unit/domain/access-matrix.test.ts`
- [ ] T026 [P] [US1] Write approval, demotion, disable, version-conflict, and last-Owner tests in `tests/integration/memberships.test.ts`
- [ ] T027 [US1] Define roles, statuses, capabilities, management boundaries, and route policies in `src/domain/access.ts`
- [ ] T028 [US1] Implement signed unique session/OAuth cookies, PKCE, GitHub identity exchange, and local fail-closed fixture adapter in `src/server/auth.ts`
- [ ] T029 [US1] Implement atomic fixed-ID bootstrap and Pending Editor membership repository in `src/server/repositories/memberships.ts`
- [ ] T030 [US1] Implement current-membership authorization middleware and capability checks in `src/server/authorize.ts`
- [ ] T031 [US1] Implement membership lifecycle service with last-Owner protection and audit in `src/server/services/memberships.ts`
- [ ] T032 [US1] Implement `/auth/*`, `/api/session`, and `/api/memberships*` routes in `src/server/routes/auth.ts` and `src/server/routes/memberships.ts`
- [ ] T033 [US1] Replace role simulation with signed-out, pending, disabled, unavailable, and authenticated shells in `src/client/App.tsx` and `src/client/components/SessionGate.tsx`
- [ ] T034 [US1] Add local and browser bootstrap/access journeys in `e2e/access.spec.ts`

## Phase 4 — US2 Author and preserve app content (P1)

- [ ] T035 [P] [US2] Write complete manifest-schema boundary tests for every element and configuration area in `tests/unit/content/manifest.test.ts`
- [ ] T036 [P] [US2] Write draft CRUD, duplicate/archive/recover, immutable revision, and stale-parent tests in `tests/integration/drafts.test.ts`
- [ ] T037 [P] [US2] Write image upload/type/size/checksum/accessibility and media reachability tests in `tests/integration/media.test.ts`
- [ ] T038 [US2] Replace prototype manifest with bounded schema-v1 types and defaults in `src/content/manifest.ts`
- [ ] T039 [US2] Implement immutable draft/revision repository and optimistic-concurrency service in `src/server/repositories/drafts.ts` and `src/server/services/drafts.ts`
- [ ] T040 [US2] Implement media repository, image metadata parsing/chunking, external AV metadata, and lifecycle service in `src/server/repositories/media.ts` and `src/server/services/media.ts`
- [ ] T041 [US2] Implement draft/revision and private media routes in `src/server/routes/drafts.ts` and `src/server/routes/media.ts`
- [ ] T042 [US2] Implement typed fetch client, abort/retry policy, errors, and session refresh in `src/client/api.ts`
- [ ] T043 [US2] Implement draft chooser, create/duplicate/archive/recover, save status, revision history, and conflict recovery in `src/client/components/DraftBar.tsx`
- [ ] T044 [US2] Implement screen and all supported element editors with reorder/duplicate/delete in `src/client/panels/ContentPanel.tsx`
- [ ] T045 [US2] Implement image upload and external audio/video library management in `src/client/panels/LibraryPanel.tsx`
- [ ] T046 [US2] Implement persistent Navigation, Branding, Audience, Notifications, and Settings panels in `src/client/panels/NavigationPanel.tsx`, `BrandingPanel.tsx`, `AudiencePanel.tsx`, `NotificationsPanel.tsx`, and `SettingsPanel.tsx`
- [ ] T047 [US2] Render manifest-equivalent phone/tablet preview with navigation and audience selection in `src/preview/AppPreview.tsx`
- [ ] T048 [US2] Add complete author/save/reload/conflict/media browser journeys in `e2e/authoring.spec.ts`

## Phase 5 — US3 Release exact content to devices (P1)

- [ ] T049 [P] [US3] Write release-validation issue-path and readiness tests in `tests/unit/content/release-validation.test.ts`
- [ ] T050 [P] [US3] Write signed-envelope deterministic signature and verification-vector tests in `tests/unit/content/release.test.ts`
- [ ] T051 [P] [US3] Write Publisher Staging, Admin Production, exact-digest, rollback, and idempotency tests in `tests/integration/releases.test.ts`
- [ ] T052 [P] [US3] Write anonymous ETag/304/key/media/privacy/cache contract tests in `tests/integration/public-content.test.ts`
- [ ] T053 [US3] Implement deterministic release validator with schema/navigation/media/a11y/link/compatibility/campaign checks in `src/content/validation.ts`
- [ ] T054 [US3] Implement immutable release, channel-event, and pointer repositories in `src/server/repositories/releases.ts`
- [ ] T055 [US3] Implement signed Staging publish, exact Production promotion, and prior-Production rollback services in `src/server/services/releases.ts`
- [ ] T056 [US3] Implement protected validation/release/history/rollback routes in `src/server/routes/releases.ts`
- [ ] T057 [US3] Implement anonymous Production envelope, public key, and reachable-media routes with ETags in `src/server/routes/public-content.ts`
- [ ] T058 [US3] Implement release validation, channel status, history, exact-candidate confirmation, and rollback UI in `src/client/panels/ReleasesPanel.tsx`
- [ ] T059 [US3] Add external signature-verification fixture and contract test in `tests/fixtures/verify-release.mjs` and `tests/contract/openapi.test.ts`
- [ ] T060 [US3] Add end-to-end save → Staging → Production → 304 → rollback journey in `e2e/releases.spec.ts`

## Phase 6 — US4 Operate every Builder panel (P2)

- [ ] T061 [P] [US4] Write per-panel persistence and reload component tests in `tests/unit/client/panels.test.tsx`
- [ ] T062 [P] [US4] Write no-placeholder/no-simulated-success static test in `tests/unit/client/completeness.test.ts`
- [ ] T063 [US4] Implement persistent Access panel with pending queue and scoped role controls in `src/client/panels/AccessPanel.tsx`
- [ ] T064 [US4] Complete Content and Library empty/loading/error/validation states in `src/client/panels/ContentPanel.tsx` and `src/client/panels/LibraryPanel.tsx`
- [ ] T065 [US4] Complete Navigation, Branding, Audience, Notifications, and Settings states in their `src/client/panels/` modules
- [ ] T066 [US4] Implement route-aware sidebar, responsive panel shell, actual identity menu, and sign-out in `src/client/components/AppShell.tsx`
- [ ] T067 [US4] Implement accessible confirmations, toasts, validation summary, unsaved-change warning, and recovery UI in `src/client/components/feedback/`
- [ ] T068 [US4] Remove all prototype role/content state and placeholder messaging from `src/client/App.tsx`
- [ ] T069 [US4] Add nine-panel persistence and reload journey in `e2e/panels.spec.ts`

## Phase 7 — US5 Audit and recover safely (P2)

- [ ] T070 [P] [US5] Write safe audit visibility/redaction/pagination tests in `tests/integration/audit.test.ts`
- [ ] T071 [P] [US5] Write health/capacity no-secret and degraded-dependency tests in `tests/integration/operations.test.ts`
- [ ] T072 [US5] Implement audit and operations read repositories/services in `src/server/repositories/operations.ts` and `src/server/services/operations.ts`
- [ ] T073 [US5] Implement Owner-only audit and operations routes in `src/server/routes/operations.ts`
- [ ] T074 [US5] Implement audit, capacity, health, release, and rollback operations UI in `src/client/panels/OperationsPanel.tsx`
- [ ] T075 [US5] Add audit trail and recovery browser journey in `e2e/operations.spec.ts`

## Phase 8 — US6 Accessible phone/tablet-first Builder (P3)

- [ ] T076 [P] [US6] Add design-token, focus, contrast, touch-target, reduced-motion, and responsive CSS in `src/client/app.css`
- [ ] T077 [P] [US6] Add keyboard interaction component tests in `tests/unit/client/keyboard.test.tsx`
- [ ] T078 [P] [US6] Add phone, tablet portrait, tablet landscape, and desktop viewports in `playwright.config.ts`
- [ ] T079 [US6] Add automated axe, focus-order, keyboard-trap, and horizontal-overflow checks in `e2e/accessibility.spec.ts`
- [ ] T080 [US6] Add interactive phone/tablet preview viewport and device-safe-area checks in `e2e/preview.spec.ts`
- [ ] T081 [US6] Add deterministic API read/save p95 harness and thresholds in `tests/performance/api-performance.test.ts`
- [ ] T082 [US6] Verify all responsive/accessibility/performance targets via `npm run check:experience`

## Phase 9 — Polish, integration, and production delivery

- [ ] T083 [P] Validate `specs/003-complete-builder/contracts/openapi.yaml` and keep route implementations contract-complete
- [ ] T084 [P] Add production secret/config preflight without revealing values in `scripts/verify-production-config.ts`
- [ ] T085 [P] Extend live verifier for security headers, safe health, Production ETag/304, public key, asset digest, and no protected anonymous routes in `scripts/verify-live.mjs`
- [ ] T086 [P] Add dependency, secret, and static-bundle leak checks to `package.json` and `.github/workflows/quality.yml`
- [ ] T087 Update `README.md`, `docs/architecture.html`, and governance statements for implemented Production behavior
- [ ] T088 Run format, generated bindings, types, lint, contract, migrations, coverage, build, audit, performance, responsive, accessibility, and full E2E gates with zero unexplained skips
- [ ] T089 Configure the existing PointSite Builder GitHub App with exact PointApp callback and all-organization repository selection, preserving permissions and existing callbacks
- [ ] T090 Install PointApp Builder OAuth/session/release-signing secrets and public key identifier without writing or printing secret values
- [ ] T091 Rehearse and apply the D1 production migration, then verify schema and preserved baseline records
- [ ] T092 Commit/push reviewed changes, obtain green GitHub Quality for the exact commit, merge to `main`, and confirm clean exact local `main`
- [ ] T093 Deploy the exact passing `main` commit directly to Builder Production and run live API/browser/authenticated verification before inviting Owner human testing

## Dependencies

- Phase 2 blocks all user stories.
- US1 blocks every protected user story.
- US2 blocks US3 because releases reference immutable saved revisions and media.
- US3 can be tested independently once a deterministic revision fixture exists.
- US4 and US5 depend on their server slices but can otherwise progress independently.
- US6 applies continuously and receives its final matrix after every panel is complete.
- Production configuration and deployment cannot start until T088 is fully green.
