import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

export const POINTAPP_CLOUDFLARE_EMAIL = 'connect@pointaustin.org';
export const POINTAPP_CLOUDFLARE_ACCOUNT_ID = 'bc890091d86ddf9ce669e96e79d47746';

type WranglerIdentity = {
  loggedIn?: unknown;
  email?: unknown;
  accounts?: unknown;
};

export function validatePointAppCloudflareIdentity(value: unknown): {
  accountId: string;
  email: string;
} {
  if (!value || typeof value !== 'object') {
    throw new Error('Wrangler returned an invalid response; refusing PointApp Cloudflare access.');
  }

  const identity = value as WranglerIdentity;
  const hasExpectedAccount =
    Array.isArray(identity.accounts) &&
    identity.accounts.some(
      (account: unknown) =>
        account !== null &&
        typeof account === 'object' &&
        (account as Record<string, unknown>).id === POINTAPP_CLOUDFLARE_ACCOUNT_ID,
    );

  if (
    identity.loggedIn !== true ||
    identity.email !== POINTAPP_CLOUDFLARE_EMAIL ||
    !hasExpectedAccount
  ) {
    throw new Error(
      `PointApp Cloudflare account mismatch. Expected ${POINTAPP_CLOUDFLARE_EMAIL} / ${POINTAPP_CLOUDFLARE_ACCOUNT_ID}; refusing to continue.`,
    );
  }

  return { accountId: POINTAPP_CLOUDFLARE_ACCOUNT_ID, email: POINTAPP_CLOUDFLARE_EMAIL };
}

async function main(): Promise<void> {
  const run = promisify(execFile);
  const { stdout } = await run('npx', ['wrangler', 'whoami', '--json'], {
    maxBuffer: 1024 * 1024,
  });
  const identity = validatePointAppCloudflareIdentity(JSON.parse(stdout) as unknown);
  process.stdout.write(
    `Verified PointApp Cloudflare account ${identity.email} / ${identity.accountId}.\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
