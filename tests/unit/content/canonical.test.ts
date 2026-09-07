import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  digestCanonicalJson,
  exportPublicJwk,
  generateSigningKeyPair,
  signCanonicalJson,
  verifyCanonicalJson,
} from '../../../src/content/crypto';

describe('canonical release cryptography', () => {
  it('sorts object keys recursively while preserving array order', () => {
    expect(canonicalJson({ z: 1, a: { y: true, x: ['b', 'a'] } })).toBe(
      '{"a":{"x":["b","a"],"y":true},"z":1}',
    );
  });

  it('produces the same SHA-256 digest for semantically identical key order', async () => {
    await expect(digestCanonicalJson({ b: 2, a: 1 })).resolves.toBe(
      await digestCanonicalJson({ a: 1, b: 2 }),
    );
  });

  it('signs with Ed25519 and verifies with only the public JWK', async () => {
    const pair = await generateSigningKeyPair();
    const publicJwk = await exportPublicJwk(pair.publicKey);
    const payload = { revisionId: 'r-1', digest: await digestCanonicalJson({ hello: 'Point' }) };
    const signature = await signCanonicalJson(pair.privateKey, payload);

    await expect(verifyCanonicalJson(publicJwk, payload, signature)).resolves.toBe(true);
    await expect(
      verifyCanonicalJson(publicJwk, { ...payload, revisionId: 'r-2' }, signature),
    ).resolves.toBe(false);
  });

  it('rejects unsupported canonical JSON values instead of silently changing them', () => {
    expect(() => canonicalJson({ invalid: Number.NaN })).toThrow('finite JSON number');
    expect(() => canonicalJson({ invalid: undefined })).toThrow('canonical JSON value');
  });
});
