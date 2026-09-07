# Internal implementation plan: PointApp Builder foundation

## Dependency graph

Research and product boundary -> content and access contracts -> responsive preview -> Builder shell -> quality gates -> private repository -> Pages readiness.

## Phase 1: specification and contracts

- [x] Record scope, roles, content-delivery model, hosting constraint, and safety boundaries.
- [x] Add tested role/capability and content-manifest contracts.

## Phase 2: first vertical slice

- [x] Render one versioned sample manifest in phone and tablet staging frames.
- [x] Expose separated Builder panels and role-aware release controls in foundation mode.
- [x] Verify keyboard access, touch target sizes, and 320/768/1024/1280 layouts.

## Phase 3: repository and delivery

- [x] Add format, lint, type, unit, build, browser, and security-oriented CI gates.
- [x] Add a manual-only GitHub Pages workflow pending private Pages eligibility.
- [x] Create and push the private PointCommunity repository.
- [ ] Read back repository visibility, default branch, commit, Actions, and Pages state.

## Risks

- GitHub Free does not support Pages from a private organization repository; do not make the repository public as a workaround.
- A static Pages bundle cannot enforce authorization; all sensitive actions remain disconnected until a protected API exists.
- Content updates must remain data-only to comply with native-store executable-code policies.
- Staging fidelity depends on the future PointApp consuming the same versioned contract.

## Checkpoint

All local quality gates pass, the exact pushed commit is known, the repository is private, no PointApp repository interaction occurred, and deployment limitations are reported without overstating live status.
