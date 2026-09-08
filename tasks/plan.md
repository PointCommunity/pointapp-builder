# Internal implementation plan: PointApp Builder development pipeline

## Objective

Adopt PointSite Builder's proven Project-backed development pipeline without changing PointApp Builder's direct application deployment, immutable Staging-to-Production content contract, or native-app boundary.

## Dependency graph

Live repository and GitHub evidence -> Project and label contract -> repository policy -> pipeline skills and adapters -> deterministic checks -> CI and package wiring -> full verification and exact-head handoff.

## Architecture decisions

- Use a separate private PointCommunity Project PointApp Builder (#5); never reuse native PointApp Project #3.
- Preserve exactly one active Issue across In Progress and In Review.
- Deploy the Builder application directly to appbuilder.pointatx.org; treat PointApp Staging and Production only as signed content channels.
- Keep .agents/skills canonical, Claude adapters as regular files, and AGENTS as the imported cross-agent authority.
- Treat PRs #7 through #10 as the only pre-pipeline bootstrap exceptions and reject any later ungoverned PR.
- Report unavailable private-repository branch protection and enforce exact-tree/Quality requirements through audits.

## Implementation order

1. Create and read back the private Project and governed label taxonomy.
2. Add the PointApp-specific AGENTS and dark-mode pipeline policy/specification.
3. Add and adapt eight pipeline skills plus five pinned shared frontend skills.
4. Add cross-agent imports/adapters and skill-alignment validation.
5. Add failing tests for PointApp health, copied Canary drift, full labels, and the exact PR #7 through PR #10 exceptions; implement until green.
6. Wire package scripts, CI/security jobs, CODEOWNERS, Dependabot, pre-commit, lint, and format scopes.
7. Run all local and live read-only verification, review the diff, then commit and push only bootstrap files.

## Risks

- Project-copy drift: validate descriptions, views, workflows, repository link, and zero items.
- Release-plane confusion: make application deployment and content publication mutually explicit in every authority surface.
- Current PR conflict: preserve PRs #7 through #10 and audit them as temporary exact exceptions.
- Vendored skill drift: retain pinned provenance and verify canonical/adaptor registries.
- User-owned work: remain on the clean existing branch and stage only bootstrap-owned paths.

## Verification checkpoints

- Focused Node pipeline tests.
- Skill frontmatter and alignment validation.
- npm run check, npm run test:performance, npm run test:e2e, and git diff --check.
- Dark-mode HTML validation and source-specific terminology scans.
- npm run pipeline:health against live Project #5.
- Exact pushed-head GitHub Quality readback.
