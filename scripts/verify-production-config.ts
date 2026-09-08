import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { validatePointAppCloudflareIdentity } from './verify-cloudflare-account';

const requiredSecrets = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'SESSION_SECRET',
  'RELEASE_SIGNING_PRIVATE_JWK',
  'RELEASE_SIGNING_PUBLIC_JWK',
] as const;

export function missingProductionSecrets(value: unknown): string[] {
  if (!Array.isArray(value)) return [...requiredSecrets];
  const names = new Set(
    value.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const name = (item as { name?: unknown }).name;
      return typeof name === 'string' ? [name] : [];
    }),
  );
  return requiredSecrets.filter((name) => !names.has(name));
}

async function main(): Promise<void> {
  const run = promisify(execFile);
  const identityResult = await run('npx', ['wrangler', 'whoami', '--json'], {
    maxBuffer: 1024 * 1024,
  });
  validatePointAppCloudflareIdentity(JSON.parse(identityResult.stdout) as unknown);
  const secretResult = await run('npx', ['wrangler', 'secret', 'list', '--format', 'json'], {
    maxBuffer: 1024 * 1024,
  });
  const missing = missingProductionSecrets(JSON.parse(secretResult.stdout) as unknown);
  if (missing.length)
    throw new Error(
      `Production configuration is incomplete. Missing bindings: ${missing.join(', ')}`,
    );
  process.stdout.write(
    `Production configuration preflight passed with ${requiredSecrets.length} required secret bindings.\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
