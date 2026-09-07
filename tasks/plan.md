# Internal implementation plan: PointApp Builder foundation

## Dependency graph

Research and product boundary -> content and access contracts -> responsive preview -> Builder shell -> quality gates -> private repository -> isolated Cloudflare hosting.

## Phase 1: specification and contracts

- [x] Record scope, roles, content-delivery model, hosting constraint, and safety boundaries.
- [x] Add tested role/capability and content-manifest contracts.

## Phase 2: first vertical slice

- [x] Render one versioned sample manifest in phone and tablet staging frames.
- [x] Expose separated Builder panels and role-aware release controls in foundation mode.
- [x] Verify keyboard access, touch target sizes, and 320/768/1024/1280 layouts.

## Phase 3: repository and delivery

- [x] Add format, lint, type, unit, build, browser, and security-oriented CI gates.
- [x] Record the initial GitHub Pages eligibility constraint before the Cloudflare host was selected.
- [x] Create and push the private PointCommunity repository.
- [x] Read back repository visibility, default branch, commit, Actions, and Pages state.

## Risks

- A public client bundle cannot enforce authorization; all sensitive actions remain disconnected until the Worker API has authenticated, server-side policy.
- Content updates must remain data-only to comply with native-store executable-code policies.
- Staging fidelity depends on the future PointApp consuming the same versioned contract.

## Foundation checkpoint

All foundation quality gates passed, the exact pushed commit was known, the repository remained private, and no PointApp repository interaction occurred.

## Phase 4: Cloudflare hosting parity

- [x] Verify the live PointSite Builder hosting pattern and Point Community Cloudflare identity.
- [x] Confirm the dedicated domain `appbuilder.pointatx.org`.
- [x] Create the isolated `pointapp-builder` D1 database.
- [x] Add the Worker health and fail-closed API boundary test-first.
- [x] Replace GitHub Pages configuration and documentation with Cloudflare Worker deployment.
- [x] Run local quality and browser verification.
- [x] Commit and push the exact deployment candidate; wait for GitHub Quality.
- [x] Deploy the exact clean candidate and verify Cloudflare, TLS, health, assets, responsive UI, and console state.

## Hosting checkpoint

The dedicated Worker and D1 binding are live at `appbuilder.pointatx.org`. HTTPS redirection, runtime health, fail-closed routes, compiled assets, phone/tablet layouts, and a clean browser console were verified without enabling authentication or publishing.
