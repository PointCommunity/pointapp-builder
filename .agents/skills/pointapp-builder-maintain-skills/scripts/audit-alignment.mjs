#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../../..');
const pipelineSkillNames = [
  'pointapp-builder-create-issue',
  'pointapp-builder-audit-issues',
  'pointapp-builder-work-issue',
  'pointapp-builder-review-issue',
  'pointapp-builder-release-production',
  'pointapp-builder-close-issue',
  'pointapp-builder-pipeline-health',
  'pointapp-builder-maintain-skills',
];
const sharedDesignSkillNames = [
  'awesome-design',
  'design-taste-frontend',
  'image-to-code',
  'playwright-cli',
  'web-design-guidelines',
];
const skillNames = [...pipelineSkillNames, ...sharedDesignSkillNames];
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireText(content, needle, owner) {
  if (!content.includes(needle)) errors.push(`${owner} does not contain ${JSON.stringify(needle)}`);
}

function forbidText(content, needle, owner) {
  if (content.includes(needle))
    errors.push(`${owner} unexpectedly contains ${JSON.stringify(needle)}`);
}

const agents = read('AGENTS.md');
const claude = read('CLAUDE.md').trim();
const gemini = read('GEMINI.md').trim();
const policyPath = '.agents/pointapp-builder-pipeline-policy.html';
const policy = read(policyPath);
const packageJson = JSON.parse(read('package.json') || '{}');
const qualityWorkflow = read('.github/workflows/quality.yml');
const preCommit = read('.pre-commit-config.yaml');

if (claude !== '@AGENTS.md') errors.push('CLAUDE.md must contain only @AGENTS.md');
if (gemini !== '@./AGENTS.md') errors.push('GEMINI.md must contain only @./AGENTS.md');
requireText(policy, 'color-scheme: dark', policyPath);
requireText(policy, 'Approved to create this exact GitHub Issue', policyPath);
requireText(policy, 'Private PointCommunity Project <code>PointApp Builder</code>', policyPath);
requireText(policy, '<code>5</code>', policyPath);
requireText(policy, 'Backlog, On Hold, In Progress, In Review, Done', policyPath);
requireText(policy, 'Agent-owned Project movement', policyPath);
requireText(policy, 'Pull request merged', policyPath);
requireText(policy, 'is disabled', policyPath);
requireText(policy, 'Production only at', policyPath);
requireText(
  policy,
  'There is no routine second approval and no Builder staging or Canary',
  policyPath,
);
requireText(policy, 'PR #7 on <code>codex/003-complete-builder</code>', policyPath);
requireText(policy, 'PR #8 on', policyPath);
requireText(policy, '<code>codex/oauth-live-fix</code>', policyPath);
requireText(policy, 'PR #9', policyPath);
requireText(
  policy,
  'PointApp Staging and Production remain separate immutable content channels',
  policyPath,
);
requireText(policy, 'Never close an Issue after merge alone', policyPath);
requireText(agents, 'Exactly one Issue may be active', 'AGENTS.md');
requireText(agents, 'Never ask the PM to move a Project card', 'AGENTS.md');
requireText(agents, 'It has no Builder staging or Canary environment', 'AGENTS.md');
requireText(agents, 'deploy the exact clean `origin/main` revision', 'AGENTS.md');
requireText(agents, 'PR #7 on `codex/003-complete-builder`', 'AGENTS.md');
requireText(agents, 'PR #8 on `codex/oauth-live-fix`', 'AGENTS.md');
requireText(agents, 'PR #9 on that same branch', 'AGENTS.md');
requireText(agents, 'PointApp Staging and Production are immutable content channels', 'AGENTS.md');
forbidText(policy, 'PointSite', policyPath);

const transitionContracts = {
  'pointapp-builder-create-issue': 'never ask the PM to add or move the card',
  'pointapp-builder-work-issue': 'agent-owned Project transition',
  'pointapp-builder-review-issue': 'agent-owned Project transition',
  'pointapp-builder-close-issue': 'agent-owned Project transition',
};
for (const [skillName, contract] of Object.entries(transitionContracts)) {
  requireText(
    read(`.agents/skills/${skillName}/SKILL.md`),
    contract,
    `.agents/skills/${skillName}/SKILL.md`,
  );
}

for (const skillName of pipelineSkillNames) {
  requireText(agents, `\`${skillName}\``, 'AGENTS.md');
}
for (const skillName of sharedDesignSkillNames) {
  requireText(agents, `\`${skillName}\``, 'AGENTS.md');
}

for (const skillName of skillNames) {
  const canonicalRelative = `.agents/skills/${skillName}/SKILL.md`;
  const canonical = read(canonicalRelative);
  const frontmatter = canonical.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatter) {
    errors.push(`${canonicalRelative} has invalid frontmatter`);
  } else {
    requireText(frontmatter[1], `name: ${skillName}`, canonicalRelative);
    if (!/^description:\s*.+$/m.test(frontmatter[1])) {
      errors.push(`${canonicalRelative} has no description`);
    }
  }

  const adapterRelative = `.claude/skills/${skillName}/SKILL.md`;
  const adapterPath = path.join(repoRoot, adapterRelative);
  const adapter = read(adapterRelative);
  if (fs.existsSync(adapterPath) && fs.lstatSync(adapterPath).isSymbolicLink()) {
    errors.push(`${adapterRelative} must be a regular file, not a symlink`);
  }
  requireText(adapter, `name: ${skillName}`, adapterRelative);
  requireText(adapter, `../../../.agents/skills/${skillName}/SKILL.md`, adapterRelative);
}

const canonicalRoot = path.join(repoRoot, '.agents/skills');
if (fs.existsSync(canonicalRoot)) {
  const actual = fs
    .readdirSync(canonicalRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const expected = [...skillNames].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(
      `canonical skill registry mismatch: expected ${expected.join(', ')}; found ${actual.join(', ')}`,
    );
  }
}

const expectedScripts = {
  'skills:check':
    'node --test .agents/skills/pointapp-builder-maintain-skills/scripts/pipeline-scripts.test.mjs && node .agents/skills/pointapp-builder-maintain-skills/scripts/audit-alignment.mjs',
  'pipeline:health':
    'node .agents/skills/pointapp-builder-pipeline-health/scripts/audit-pipeline.mjs',
  'verify:live': 'node .agents/skills/pointapp-builder-release-production/scripts/verify-live.mjs',
};
for (const [name, command] of Object.entries(expectedScripts)) {
  if (packageJson.scripts?.[name] !== command)
    errors.push(`package.json ${name} is missing or misaligned`);
}
if (!packageJson.scripts?.check?.includes('npm run skills:check')) {
  errors.push('package.json check must include skills:check');
}
requireText(qualityWorkflow, 'npm run check', '.github/workflows/quality.yml');
requireText(qualityWorkflow, "'issue/**'", '.github/workflows/quality.yml');
requireText(qualityWorkflow, 'trufflesecurity/trufflehog@', '.github/workflows/quality.yml');
requireText(qualityWorkflow, 'semgrep==', '.github/workflows/quality.yml');
requireText(preCommit, 'gitleaks/gitleaks', '.pre-commit-config.yaml');

for (const relativePath of [
  '.agents/skills/pointapp-builder-maintain-skills/scripts/pipeline-scripts.test.mjs',
  '.agents/skills/pointapp-builder-pipeline-health/scripts/audit-pipeline.mjs',
  '.agents/skills/pointapp-builder-release-production/scripts/verify-live.mjs',
]) {
  read(relativePath);
}

if (errors.length > 0) {
  console.error(`PointApp Builder skill alignment failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `PointApp Builder skill alignment OK: ${pipelineSkillNames.length} workflow skills, ${sharedDesignSkillNames.length} shared design skills, and ${skillNames.length} Claude adapters.`,
);
