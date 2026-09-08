// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { signCanonicalJson } from '../../src/content/crypto';
import { sampleManifest } from '../../src/content/manifest';
import { generatedSigner } from '../../src/server/services/releases';

describe('published contract', () => {
  it('documents every implemented control and content plane route', () => {
    const contract = readFileSync(
      resolve('specs/003-complete-builder/contracts/openapi.yaml'),
      'utf8',
    );
    for (const path of [
      '/api/session:',
      '/api/memberships:',
      '/api/drafts:',
      '/api/media:',
      '/api/releases:',
      '/api/audit:',
      '/api/operations:',
      '/content/v1/channels/production:',
      '/content/v1/keys/{keyId}:',
      '/content/v1/media/{mediaId}:',
    ])
      expect(contract).toContain(path);
  });
  it('can verify a release signature in an independent Node process', async () => {
    const signer = await generatedSigner('fixture-key');
    const unsigned = {
      contractVersion: 1,
      releaseId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      manifestDigest: 'a'.repeat(64),
      releasedAt: new Date().toISOString(),
      compatibility: { manifestSchema: 1, minimumClientContract: 1 },
      manifest: sampleManifest,
    };
    const envelope = {
      ...unsigned,
      signing: {
        algorithm: 'Ed25519',
        keyId: signer.keyId,
        signature: await signCanonicalJson(signer.privateKey, unsigned),
      },
    };
    const result = spawnSync(process.execPath, [resolve('tests/fixtures/verify-release.mjs')], {
      input: JSON.stringify({ envelope, publicJwk: signer.publicJwk }),
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('verified\n');
  });
});
