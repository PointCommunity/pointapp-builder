import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const patterns = [
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['private OKP JWK', /"d"\s*:\s*"[A-Za-z0-9_-]{40,}"/g],
];
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((path) => path && !path.endsWith('package-lock.json'));
const findings = [];
for (const path of files) {
  let source;
  try {
    source = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  for (const [label, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      findings.push(`${path}:${source.slice(0, match.index).split('\n').length} (${label})`);
    }
  }
}
if (findings.length) {
  process.stderr.write(`Potential source secrets detected:\n${findings.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Source secret pattern check passed across ${files.length} files.\n`);
}
