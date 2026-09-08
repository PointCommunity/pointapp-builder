import { describe, expect, it } from 'vitest';
import { sampleManifest } from '../../src/content/manifest';
import { ReleaseEnvelopeSchema } from '../../src/content/release';

const envelope = {
  contractVersion: 1,
  releaseId: '01993dc8-4e00-7000-8000-000000000001',
  revisionId: '01993dc8-4e00-7000-8000-000000000002',
  manifestDigest: 'a'.repeat(64),
  releasedAt: '2026-09-07T12:00:00.000Z',
  compatibility: { manifestSchema: 1, minimumClientContract: 1 },
  manifest: sampleManifest,
  signing: { algorithm: 'Ed25519', signature: 'c2lnbmF0dXJl', keyId: 'pointapp-2026-01' },
};
describe('PointApp content release envelope', () => {
  it('accepts a signed data-only content release', () =>
    expect(ReleaseEnvelopeSchema.parse(envelope)).toEqual(envelope));
  it('requires a complete SHA-256 digest', () =>
    expect(() => ReleaseEnvelopeSchema.parse({ ...envelope, manifestDigest: 'abc' })).toThrow());
  it('rejects executable or unknown fields', () =>
    expect(() =>
      ReleaseEnvelopeSchema.parse({
        ...envelope,
        manifest: { ...sampleManifest, executable: 'code' },
      }),
    ).toThrow());
});
