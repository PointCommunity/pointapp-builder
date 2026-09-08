import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractAssetPaths,
  validateHealthPayload,
  validateHtml,
} from '../../pointapp-builder-release-production/scripts/verify-live.mjs';
import { auditPipelineSnapshot } from '../../pointapp-builder-pipeline-health/scripts/audit-pipeline.mjs';

const projectFields = [
  {
    name: 'Status',
    options: [
      ['Backlog', 'Triaged and ready to be selected.'],
      ['On Hold', 'Inactive work paused only at the PM request.'],
      ['In Progress', 'The single active Issue currently being implemented or remediated.'],
      [
        'In Review',
        'The single active Issue whose exact PR candidate passed agent QA and GitHub Quality.',
      ],
      ['Done', 'Builder production deployment verified and the Issue closed.'],
    ].map(([name, description]) => ({ name, description })),
  },
  { name: 'Priority', options: ['P0', 'P1', 'P2', 'P3'].map((name) => ({ name })) },
  { name: 'Impact', options: ['High', 'Medium', 'Low'].map((name) => ({ name })) },
  { name: 'Effort', options: ['XS', 'S', 'M', 'L', 'XL'].map((name) => ({ name })) },
];

const projectViews = ['Backlog', 'Kanban'].map((name) => ({
  name,
  layout: 'BOARD_LAYOUT',
  verticalGroupBy: 'Status',
}));

const projectWorkflows = [
  'Auto-add sub-issues to project',
  'Auto-close issue',
  'Item added to project',
  'Item closed',
  'Pull request linked to issue',
  'Pull request merged',
].map((name) => ({ name, enabled: name !== 'Pull request merged' }));

const governedLabels = [
  ['type:bug', 'D73A4A'],
  ['type:feature', 'A2EEEF'],
  ['type:maintenance', '1D76DB'],
  ['type:security', 'B60205'],
  ['area:authoring', '1D76DB'],
  ['area:data', '006B75'],
  ['area:deployment', 'FBCA04'],
  ['area:documentation', '0075CA'],
  ['area:identity', 'C5DEF5'],
  ['area:media', 'BFDADC'],
  ['area:publishing', '5319E7'],
  ['area:ui', '0E8A16'],
  ['area:workflow', '6F42C1'],
].map(([name, color]) => ({ name, color }));

function baseSnapshot(overrides = {}) {
  return {
    project: {
      title: 'PointApp Builder',
      public: false,
      closed: false,
      shortDescription:
        'Agent-managed PointApp Builder development pipeline with one active Issue maximum and direct verified Builder production deployment.',
    },
    fields: projectFields,
    repositories: ['PointCommunity/pointapp-builder'],
    views: projectViews,
    workflows: projectWorkflows,
    availableLabels: governedLabels,
    branch: 'main',
    head: 'abc123',
    remoteMain: 'abc123',
    statusPorcelain: '',
    branchProtection: 'unavailable-private-plan',
    issues: [],
    items: [],
    prs: [],
    ...overrides,
  };
}

test('validates the Builder production health contract', () => {
  assert.deepEqual(
    validateHealthPayload({
      status: 'ok',
      service: 'pointapp-builder',
      environment: 'production',
      version: '0.1.0',
      checks: { database: 'ok', authentication: 'ok', publishing: 'ok' },
    }),
    { service: 'pointapp-builder', environment: 'production', version: '0.1.0' },
  );
  assert.throws(
    () =>
      validateHealthPayload({
        status: 'ok',
        service: 'pointapp-builder',
        environment: 'staging',
        version: '0.1.0',
        checks: { database: 'ok', authentication: 'ok', publishing: 'ok' },
      }),
    /production/,
  );
});

test('extracts unique local build assets from valid Builder HTML', () => {
  const html = `<!doctype html><html><head><title>PointApp Builder</title>
    <script type="module" src="/assets/app.js"></script>
    <link rel="stylesheet" href="/assets/app.css">
    <script src="/assets/app.js"></script>
    <script src="https://example.com/ignored.js"></script>
  </head><body><div id="root"></div></body></html>`;

  assert.doesNotThrow(() => validateHtml(html));
  assert.deepEqual(extractAssetPaths(html), ['/assets/app.js', '/assets/app.css']);
  assert.throws(
    () =>
      validateHtml(
        '<!doctype html><html><head><title>Other</title></head><body><div id="root"></div></body></html>',
      ),
    /PointApp Builder/,
  );
});

test('accepts a complete unassigned Backlog card and reports the branch-rule limitation', () => {
  const result = auditPipelineSnapshot(
    baseSnapshot({
      issues: [
        {
          number: 18,
          labels: [{ name: 'type:feature' }, { name: 'area:ui' }],
          assignees: [],
        },
      ],
      items: [
        {
          content: { type: 'Issue', number: 18 },
          status: 'Backlog',
          priority: 'P1',
          impact: 'High',
          effort: 'M',
        },
      ],
    }),
  );

  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes('branch rules are unavailable')));
  assert.equal(result.activeItems.length, 0);
});

test('rejects the former Project and Backlog view names', () => {
  const result = auditPipelineSnapshot(
    baseSnapshot({
      project: {
        title: 'PointApp Builder Development',
        public: false,
        closed: false,
        shortDescription: 'Wrong description',
      },
      views: ['Backlog Priorities', 'Kanban'].map((name) => ({
        name,
        layout: 'BOARD_LAYOUT',
        verticalGroupBy: 'Status',
      })),
    }),
  );

  assert.ok(result.errors.some((error) => error.includes('Project must be')));
  assert.ok(result.errors.some((error) => error.includes('Backlog must be a board view')));
  assert.ok(result.errors.some((error) => error.includes('unexpected Project views')));
});

test('rejects copied Canary terminology and an incomplete governed label set', () => {
  const fields = structuredClone(projectFields);
  fields[0].options.find((option) => option.name === 'In Review').description =
    'The single active Issue deployed to Canary for PM review and testing.';
  const result = auditPipelineSnapshot(
    baseSnapshot({
      fields,
      availableLabels: governedLabels.filter((label) => label.name !== 'area:publishing'),
    }),
  );

  assert.ok(result.errors.some((error) => error.includes('In Review description mismatch')));
  assert.ok(
    result.errors.some((error) => error.includes('missing governed label area:publishing')),
  );
});

test('accepts one In Review Issue, an exact linked PR, and ignores Dependabot PRs', () => {
  const result = auditPipelineSnapshot(
    baseSnapshot({
      branch: 'issue/42-editor-fix',
      head: 'abc123',
      remoteMain: 'def456',
      issues: [
        {
          number: 42,
          labels: [{ name: 'type:bug' }, { name: 'area:ui' }],
          assignees: [{ login: 'brimdor' }],
        },
      ],
      items: [
        {
          content: { type: 'Issue', number: 42 },
          status: 'In Review',
          priority: 'P1',
          impact: 'High',
          effort: 'S',
        },
      ],
      prs: [
        {
          number: 9,
          body: 'Refs #42',
          headRefName: 'issue/42-editor-fix',
          baseRefName: 'main',
          isDraft: false,
          statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
        },
        {
          number: 10,
          body: 'Automated update',
          headRefName: 'dependabot/npm_and_yarn/react-20',
          baseRefName: 'main',
          statusCheckRollup: [],
        },
      ],
    }),
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.activeItems.length, 1);
  assert.equal(result.pipelinePrs.length, 1);
  assert.equal(result.dependabotPrs.length, 1);
});

test('reports the exact pre-pipeline PRs #7 through #9 as bounded bootstrap exceptions', () => {
  const result = auditPipelineSnapshot(
    baseSnapshot({
      prs: [
        {
          number: 7,
          body: 'Complete the pre-pipeline Builder bootstrap.',
          headRefName: 'codex/003-complete-builder',
          baseRefName: 'main',
          isDraft: false,
          statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
        },
        {
          number: 8,
          body: 'Harden the live OAuth exchange before pipeline adoption.',
          headRefName: 'codex/oauth-live-fix',
          baseRefName: 'main',
          isDraft: false,
          statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
        },
        {
          number: 9,
          body: 'Fix the follow-up OAuth fetch invocation defect.',
          headRefName: 'codex/oauth-live-fix',
          baseRefName: 'main',
          isDraft: false,
          statusCheckRollup: [{ status: 'IN_PROGRESS', conclusion: '' }],
        },
      ],
    }),
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.bootstrapPrs.length, 3);
  assert.equal(result.pipelinePrs.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes('bootstrap exception PR #7')));
});

test('rejects any unreferenced non-Dependabot PR outside the exact bootstrap exception', () => {
  const result = auditPipelineSnapshot(
    baseSnapshot({
      prs: [
        {
          number: 10,
          body: 'Untracked work.',
          headRefName: 'codex/untracked-work',
          baseRefName: 'main',
          isDraft: false,
          statusCheckRollup: [],
        },
      ],
    }),
  );

  assert.ok(result.errors.some((error) => error.includes('must reference exactly one Issue')));
  assert.equal(result.bootstrapPrs.length, 0);
});

test('rejects multiple active cards, incomplete metadata, and auto-closing PRs', () => {
  const result = auditPipelineSnapshot(
    baseSnapshot({
      issues: [
        {
          number: 1,
          labels: [{ name: 'type:feature' }, { name: 'area:ui' }],
          assignees: [{ login: 'brimdor' }],
        },
        {
          number: 2,
          labels: [{ name: 'type:bug' }],
          assignees: [{ login: 'brimdor' }],
        },
      ],
      items: [
        {
          content: { type: 'Issue', number: 1 },
          status: 'In Progress',
          priority: 'P1',
          impact: 'High',
          effort: 'M',
        },
        {
          content: { type: 'Issue', number: 2 },
          status: 'In Review',
          priority: 'P2',
          impact: 'Medium',
          effort: '',
        },
      ],
      prs: [
        {
          number: 3,
          body: 'Fixes #1',
          headRefName: 'issue/1-first',
          baseRefName: 'main',
          statusCheckRollup: [],
        },
      ],
    }),
  );

  assert.ok(result.errors.some((error) => error.includes('single-active-Issue violation')));
  assert.ok(result.errors.some((error) => error.includes('missing effort')));
  assert.ok(result.errors.some((error) => error.includes('at least one area label')));
  assert.ok(result.errors.some((error) => error.includes('auto-close')));
});
