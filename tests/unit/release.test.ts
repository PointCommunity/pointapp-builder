import { describe, expect, it } from 'vitest';
import { sampleManifest } from '../../src/content/manifest';
import { ReleaseEnvelopeSchema } from '../../src/content/release';

const envelope = {
  envelopeVersion: 1,
  releasedAt: '2026-09-07T12:00:00.000Z',
  manifest: { ...sampleManifest, channel: 'staging' as const },
  integrity: {
    algorithm: 'ed25519-sha256' as const,
    digest: 'a'.repeat(64),
    signature: 'c2lnbmF0dXJl',
    keyId: 'pointapp-content-2026-01',
  },
};

describe('PointApp content release envelope', () => {
  it('accepts a signed, non-draft content release', () => {
    expect(ReleaseEnvelopeSchema.parse(envelope)).toEqual(envelope);
  });

  it('does not release draft manifests to installed apps', () => {
    expect(() =>
      ReleaseEnvelopeSchema.parse({
        ...envelope,
        manifest: { ...sampleManifest, channel: 'draft' },
      }),
    ).toThrow(/Staging or Production/);
  });

  it('requires a complete SHA-256 digest', () => {
    expect(() =>
      ReleaseEnvelopeSchema.parse({
        ...envelope,
        integrity: { ...envelope.integrity, digest: 'abc' },
      }),
    ).toThrow();
  });
});
