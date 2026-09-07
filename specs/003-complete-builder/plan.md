# Internal implementation-plan index

**Branch**: `codex/003-complete-builder` | **Date**: 2026-09-07 | **Spec**: [`spec.html`](./spec.html)
**Input**: Complete PointApp Builder feature specification.

The human-readable implementation plan is [`plan.html`](./plan.html). This Markdown file exists for spec workflow tooling and agent-context parsing only.

## Summary

Build the production PointApp Builder as a Cloudflare Worker-backed React application with server-enforced GitHub authentication, governed membership, immutable D1 revisions, signed PointApp Staging and Production release channels, and comprehensive automated verification.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 22 and Cloudflare Workers 2026 runtime  
**Primary Dependencies**: React 19, Vite 8, Hono, Zod 4, Cloudflare Workers Static Assets  
**Storage**: Cloudflare D1 with immutable revisions and chunked image payloads  
**Testing**: Vitest 5, Miniflare, Testing Library, Playwright 1.63, axe-core, Redocly  
**Target Platform**: Modern evergreen browsers and Cloudflare Workers; responsive phone, tablet, and desktop Builder UI  
**Project Type**: web application  
**Performance Goals**: Primary API reads below 250 ms p95 and saves below 500 ms p95 under the repository load profile  
**Constraints**: Single Builder Production; data-only PointApp manifests; exact Staging-to-Production promotion; private repository; no secrets or private data in static assets  
**Scale/Scope**: One church organization, low hundreds of Builder identities, dozens of drafts, hundreds of revisions/media assets, nine complete product panels

## Constitution Check

- PASS: Specification and traceability precede implementation.
- PASS: Every protected capability is enforced by the Worker using current D1 membership.
- PASS: Only GitHub user ID `1202831` may bootstrap Owner; all other identities start Pending Editor.
- PASS: Published artifacts are immutable, canonical, signed, data-only manifests.
- PASS: Builder has one Production deployment; PointApp Staging and Production are content channels.
- PASS: Secrets remain Worker secrets and private draft/media data remains authenticated.
- PASS: Test-first domain changes and full repository gates are mandatory.
- PASS: Existing user work and the separate `PointCommunity/pointapp` repository remain untouched.

## Project Structure

```text
src/
├── client/             # Authenticated React application and panels
├── content/            # Manifest and release contracts
├── domain/             # Roles, validation, canonicalization
├── preview/            # Phone/tablet PointApp renderer
└── server/             # API composition, auth, D1 repositories/services

worker/
└── index.ts            # Cloudflare Worker entrypoint and public delivery

tests/
├── contract/
├── integration/
├── performance/
└── unit/

e2e/                    # Browser journeys and accessibility checks
migrations/             # Ordered backward-compatible D1 migrations
scripts/                # Verification and release tooling
```

**Structure Decision**: Keep the existing single-package web application and add clear client/server/domain boundaries. This avoids a workspace migration while allowing the Worker API and React client to be tested independently.

## Complexity Tracking

No constitution violations.
