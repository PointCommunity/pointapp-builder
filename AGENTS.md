# PointApp Builder development and release governance

## Authority and source of truth

- This file governs the PointApp Builder application in `PointCommunity/pointapp-builder`. The PM is the human GitHub user `brimdor` (Chris).
- GitHub Project: organization-owned private Project `PointApp Builder`, number `5`.
- Canonical repository skills live under `.agents/skills/`. Always use the relevant `pointapp-builder-*` skill for Issue, review, release, or pipeline work.
- Five shared frontend skills also live under `.agents/skills/`: `design-taste-frontend` for brief-led visual direction, `awesome-design` for reference selection, `image-to-code` for a selected visual target, `web-design-guidelines` for standards review, and `playwright-cli` for CLI-driven browser evidence. They support product work but never replace a `pointapp-builder-*` pipeline skill or override this file, the shared policy, the existing Builder design system, or the current Issue scope.
- `.agents/pointapp-builder-pipeline-policy.html` is the shared workflow policy. Skills may narrow a workflow but must not contradict it.
- `AGENTS.md` is canonical. `CLAUDE.md` and `GEMINI.md` import it; do not duplicate policy into tool-specific instruction files.
- Preserve unknown user-owned changes. Never reset, restore, clean, stash, overwrite, commit, or deploy them without explicit direction.

## Pipeline invariant

- Exactly one Issue may be active. Active means Project Status `In Progress` or `In Review`. Dependabot pull requests are maintenance automation and do not consume the active Issue slot.
- Before Issue or code work, read the live Project, all open Issues, open pull requests, current branch/head, available labels, and the selected Issue. Fail closed on missing or conflicting metadata.
- The agent owns all Project Status movement: `Backlog`, `On Hold`, `In Progress`, `In Review`, `Done`. Never ask the PM to move a Project card or repair pipeline metadata.
- The Project's `Pull request merged` workflow stays disabled because merge alone is not completion. The agent sets Done only after verified Builder production; the enabled Done automation may then close the Issue.
- At each transition, update Status and related metadata together, immediately read the live card back, and verify the one-active-Issue invariant.
- `On Hold` is inactive and may be used only when the PM explicitly requests it.
- Keep Status, Priority, Impact, Effort, governed labels, assignee, Issue state, branch, and PR reference aligned. Active Issues are assigned only to `brimdor`; Backlog Issues are open and unassigned.
- With no requested Issue and no active Issue, rank and recommend the top three Backlog Issues, then wait for PM selection.
- A request to work an Issue authorizes the complete Builder pipeline through production unless the PM explicitly sets an earlier stopping point. Routine Builder deployment does not require a separate staging, Canary, or production approval.
- PR #7 on `codex/003-complete-builder`, PR #8 on `codex/oauth-live-fix`, and its follow-up PR #9 on that same branch were opened before this pipeline became active. Those exact PR/branch pairs are the only bootstrap exceptions and may complete without retroactive Issues; no new product work may use the exception.

## Required workflow

- New work: use `pointapp-builder-create-issue`. Show the complete HTML Issue draft and Project metadata, then require `Approved to create this exact GitHub Issue` before creating it as an unassigned Backlog card.
- Backlog audit: use `pointapp-builder-audit-issues`. It may correct only justified Backlog metadata and must preserve every other lane and all active work.
- Implementation: use `pointapp-builder-work-issue`. Move the selected Issue to In Progress, assign it, create `issue/<number>-<slug>`, implement spec-first and test-first, and create or update a PR containing `Refs #<number>` without an auto-close keyword.
- Agent QA: use `pointapp-builder-review-issue`. Complete code review, full repository gates, local browser interaction testing for affected flows, and exact-head GitHub Quality; then move the verified candidate to In Review.
- Closure: use `pointapp-builder-close-issue`. From In Review, squash-merge the verified PR, confirm the merge tree equals the reviewed tree, wait for GitHub Quality on the exact `main` commit, invoke `pointapp-builder-release-production`, and only after live production verification move the card to Done, verify Issue closure, and unassign it.
- Production: use `pointapp-builder-release-production`. Record the previous Cloudflare version, deploy the exact clean `origin/main` revision with `npm run deploy`, verify the new Cloudflare deployment, `/api/health`, HTML-derived assets, authentication boundaries, and current signed Production content, and roll back safely if required.
- Pipeline audit: use `pointapp-builder-pipeline-health` for read-only Project, Issue, PR, CI, git, Cloudflare, and live-runtime health.
- Skill changes: use `pointapp-builder-maintain-skills` and run the repository alignment audit before committing.

## Product and content boundary

- This repository owns the PointApp Builder client, Worker API, content/release contracts, and deployment automation.
- `PointCommunity/pointapp` is a separate native product. Do not read, modify, commit, or deploy it unless the user explicitly authorizes that repository in a later task.
- Builder-authored updates are data-only manifests. Native functionality and executable-code changes must use the Apple App Store and Google Play release processes.
- The public Builder shell must never contain secrets, role assignments, private drafts, signing keys, or release credentials.
- Role order is Editor < Publisher < Administrator < Owner. Editors author drafts. Publishers may publish an exact revision to the PointApp Staging content channel. Administrators and Owners may promote the exact verified Staging revision to the Production content channel.
- Client-side affordances are not authorization. The authenticated Worker API enforces every capability independently.
- Staging and Production content channels always identify immutable manifest revisions and digests. Production promotion may never rebuild or silently alter the accepted Staging candidate.
- Preserve immutable release history, a last-known-good Production manifest, and an auditable content rollback path.

## Builder production boundary

- The Builder application has exactly one deployment environment: production at `https://appbuilder.pointatx.org`. It has no Builder staging or Canary environment, and none may be introduced unless the PM explicitly requests one.
- PointApp Staging and Production are immutable content channels inside the Builder, not deployment environments for the Builder application.
- A Builder deployment never authorizes publishing, promoting, or rolling back PointApp content, and it never authorizes changes to `PointCommunity/pointapp`.
- Builder deployments must be auditable and tied to an exact source revision. Never deploy a dirty tree, an unpushed commit, a failing commit, or a different tree from the reviewed PR.
- When schema changes are included, require migrations, backward compatibility, tests, local rehearsal, and an explicit recovery plan. Never perform destructive data or schema restoration without PM approval.
- Record the active Cloudflare version before release. If a new Builder version fails, roll back to that recorded version and verify recovery; use a reviewable revert commit for the durable source fix and never rewrite shared history.

## Quality, security, and documentation

- Use Node.js 22 or later, strict TypeScript, test-first domain changes, and mobile-first accessible UI targeting WCAG 2.2 AA.
- Before any completion claim, run formatting, generated-types checks, TypeScript, lint, contracts, migrations, unit/coverage, dependency/source/bundle security, build, performance, and relevant browser tests.
- Local hands-on browser QA is required for changed user flows before release. After deployment, verify live health, assets, anonymous isolation, GitHub login initiation, and affected authenticated behavior when supported access is already available; never request credentials or weaken authentication to manufacture evidence.
- Never put credentials, GitHub or session tokens, draft data, private media, signing keys, or sensitive operational values in source, Issues, PRs, logs, artifacts, or responses.
- Human-facing reports, diagrams, policies, and standalone documents must be HTML with Dark Mode. Markdown under `tasks/`, `specs/`, and `.specify/` is internal workflow metadata.
- GitHub currently rejects branch-protection and repository-ruleset configuration for this private repository at the organization plan level. Enforce PR, exact-tree, and Quality gates through the repository workflow and audit scripts, and report this limitation; never claim unavailable GitHub branch rules are active.

## Active technologies

- TypeScript 5.9 on Node.js 22 and Cloudflare Workers 2026 runtime with React 19, Vite 8, Hono, Zod 4, and Cloudflare Workers Static Assets.
- Cloudflare D1 with immutable revisions and chunked image payloads.

## Recent changes

- 004-development-pipeline: adopted PointSite Builder's Project-backed development model, repository-owned skills, cross-agent adapters, deterministic pipeline checks, and direct Builder production workflow while preserving PointApp-specific content channels and native-app boundaries.
- 003-complete-builder: completed the role-governed Builder, immutable signed content releases, and direct Cloudflare Worker production configuration.
