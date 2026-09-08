import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'dist/client';
const forbidden = [
  'GITHUB_CLIENT_SECRET',
  'SESSION_SECRET',
  'RELEASE_SIGNING_PRIVATE_JWK',
  'BEGIN PRIVATE KEY',
  'github_pat_',
  'ghp_',
];
function files(path) {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    return statSync(child).isDirectory() ? files(child) : [child];
  });
}
const leaks = [];
const clientFiles = files(root);
for (const path of clientFiles) {
  const contents = readFileSync(path, 'utf8');
  for (const marker of forbidden) if (contents.includes(marker)) leaks.push(`${path}: ${marker}`);
}
if (leaks.length) {
  process.stderr.write(
    `Forbidden server credential markers found in client assets:\n${leaks.join('\n')}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(`Client bundle boundary passed across ${clientFiles.length} assets.\n`);
}
