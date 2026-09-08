# PointApp Builder development governance

## Product boundary

- This repository owns the PointApp Builder client, its content/release contracts, and its deployment automation.
- `PointCommunity/pointapp` is a separate product. Do not read, modify, commit, or deploy it unless the user explicitly authorizes that repository in a later task.
- Builder-authored updates are data-only manifests. Native functionality and executable-code changes must use the Apple App Store and Google Play release processes.
- The public Builder shell must never contain secrets, role assignments, private drafts, signing keys, or release credentials.

## Roles and release invariant

- Role order is Editor < Publisher < Administrator < Owner.
- Editors author drafts. Publishers may publish an exact revision to Staging. Administrators and Owners may promote the exact verified Staging revision to Production.
- Client-side affordances are not authorization. The authenticated Worker API enforces every capability independently.
- Staging and Production always identify an immutable manifest revision and digest. Production promotion may never rebuild or silently alter the Staging candidate.
- Preserve a last-known-good Production manifest and an auditable rollback path.

## Quality and delivery

- Use Node.js 22 or later, strict TypeScript, test-first domain changes, and mobile-first accessible UI.
- Before any completion claim, run formatting, types, lint, unit/coverage, build, and relevant browser tests.
- Human-facing documents and diagrams must be dark-mode HTML. Markdown under `tasks/` is internal workflow state.
- Preserve unknown user-owned work. Never reset, clean, stash, overwrite, commit, or deploy it without direction.
- Cloudflare Worker deployments must use the verified Point Community account and an exact clean commit. The Builder has one direct Production environment; PointApp content retains separate immutable Staging and Production channels.

## Active Technologies

- TypeScript 5.9 on Node.js 22 and Cloudflare Workers 2026 runtime + React 19, Vite 8, Hono, Zod 4, Cloudflare Workers Static Assets (003-complete-builder)
- Cloudflare D1 with immutable revisions and chunked image payloads (003-complete-builder)

## Recent Changes

- 003-complete-builder: Added TypeScript 5.9 on Node.js 22 and Cloudflare Workers 2026 runtime + React 19, Vite 8, Hono, Zod 4, Cloudflare Workers Static Assets
