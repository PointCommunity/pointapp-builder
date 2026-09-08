# PointApp Builder Constitution

## Core principles

### I. Specification and traceability first

Substantial behavior begins with a reviewed specification. Every functional requirement maps to implementation tasks and verification evidence. Human-facing architecture, reports, and diagrams are dark-mode HTML; Markdown under `.specify/`, `specs/`, and `tasks/` is internal workflow state.

### II. Server-enforced least privilege

The role order is Editor < Publisher < Administrator < Owner. Browser controls never grant authority. Every protected request authenticates a stable GitHub identity and authorizes the requested capability server-side. The fixed bootstrap identity is the only account eligible to claim an empty installation; later identities begin as pending Editors until approved.

### III. Immutable releases and data-only delivery

Every save creates an immutable revision. Publishers may publish an exact revision to Staging. Administrators and Owners may promote only that unchanged verified Staging envelope to Production. Installed PointApps receive signed data manifests, never executable code, and retain a last-known-good release.

### IV. Production Builder, separated products

PointApp Builder has one deployment environment: Production at `appbuilder.pointatx.org`. It has no Builder canary or staging deployment. PointApp Staging and Production are content channels, not Builder deployment environments. `PointCommunity/pointapp` remains separate and untouched without explicit authorization.

### V. Security, privacy, and durability by default

Secrets, private drafts, role assignments, signing keys, and credentials never enter browser assets or source control. Inputs are bounded and schema-validated, mutations are origin-checked, rate-limited, idempotent where retryable, and auditable. Migrations are backward-compatible, rehearsed locally, and non-destructive. Production keeps a last-known-good release and rollback evidence.

### VI. Test-first delivery and truthful evidence

Domain and server behavior is written test-first. Before review or deployment, formatting, generated types, TypeScript, lint, contract checks, unit/integration coverage, migrations, build, performance budgets, and relevant browser tests must pass with no unexplained skips. A deployment claim requires exact-commit CI plus live health, assets, security, and affected-flow verification.

### VII. Preserve user work and external authority

Unknown user-owned changes are never reset, cleaned, stashed, overwritten, or committed. External mutations stay within explicit authorization. GitHub App installation changes preserve existing permissions unless the user approves an expansion. Destructive data or schema recovery requires explicit approval.

### VIII. Complete authoring and recoverable operations

Every supported manifest field is editable through persistent controls and represented in the phone/tablet preview. Media is private until referenced by a published manifest. Concurrent saves must preserve the rejected work as a bounded recovery draft or offer an explicit reload. Owners receive redacted operational health, capacity, audit, and rollback views without exposing secrets or payload bodies.

## Quality gates

- Node.js 22 or later and strict TypeScript.
- Testable requirements and acceptance scenarios for every user-facing flow.
- WCAG 2.2 AA target with phone, tablet, and desktop browser evidence.
- Chromium, Firefox, and WebKit must pass the protected authoring and release journeys; local HTTP fixtures may use development-only cookies, while Production uses `__Host-` Secure cookies.
- All tests pass; coverage thresholds cannot decrease to manufacture a pass.
- Exact local `HEAD`, `origin/main`, GitHub Quality SHA, and deployed source must agree.
- Authentication or publishing remains fail-closed when required configuration is absent.

## Governance

Repository `AGENTS.md` overrides this workflow constitution. Amendments require an explicit rationale, semantic version update, and consistency review across specification, plan, tasks, implementation, and tests.

## Version history

| Version | Date       | Change                                                                     |
| ------- | ---------- | -------------------------------------------------------------------------- |
| 1.1.0   | 2026-09-07 | Add complete authoring, recovery, operations, and cross-browser invariants |
| 1.0.0   | 2026-09-07 | Initial PointApp Builder project governance                                |

**Version**: 1.1.0 | **Ratified**: 2026-09-07 | **Last amended**: 2026-09-07
