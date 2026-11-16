---
name: pointapp-builder-release-production
description: 'Deploy the exact verified PointApp Builder main revision directly to its sole production environment, verify Cloudflare and live behavior, and recover the prior version on failure.'
---

# Release PointApp Builder Production

Read `AGENTS.md`, `.agents/pointapp-builder-pipeline-policy.html`, the active Issue, merged PR, exact candidate evidence, current git state, Cloudflare identity, deployment history, and applicable migration plan. Run only from `pointapp-builder-close-issue` unless the PM explicitly requests a standalone Builder deployment.

1. Require a clean local `main` with `HEAD == origin/main`, the expected merge tree, and successful GitHub Quality for that exact commit. The Builder has no staging or Canary deployment.
2. Run `npm run cloudflare:verify-account`. Record the current 100% Cloudflare Worker version and deployment before making any change; this is the non-destructive application rollback target.
3. If the release contains D1 migrations, confirm backward compatibility, completed local rehearsal, passing tests, and a documented recovery plan, then run `npm run db:migrate:remote`. Never attempt destructive data or schema rollback without PM approval.
4. Run `npm run deploy` from the clean exact `main` checkout. Capture the new Cloudflare version ID and confirm deployment history shows it receiving 100% traffic.
5. Run `npm run verify:live`. Verify `/api/health`, D1/authentication/publishing checks, production environment/version, HTTPS redirect preservation, cache-busted HTML, every HTML-derived JavaScript and stylesheet asset, anonymous isolation, GitHub login initiation, the current signed Production content envelope, and ETag revalidation. Verify affected authenticated live behavior with supported existing access when available, without weakening authentication or mutating unrelated drafts or channel pointers.
6. Add concise release evidence to the PR or Issue: source commit/tree, GitHub Quality run, prior and new Cloudflare versions, migrations, deploy command result, live verifier output, and browser evidence or its supported-access limitation.
7. If deployment or live verification fails, run `npx wrangler rollback <recorded-version-id> --message "Rollback failed PointApp Builder release" --yes`, rerun the live verifier, keep the Issue open and assigned, and prepare a reviewable source revert or remediation on the same Issue. Stop for PM authorization before destructive schema or data recovery.

This skill deploys only the Builder application. It never publishes, promotes, or rolls back PointApp content and never reads or writes the separate `PointCommunity/pointapp` native repository.
