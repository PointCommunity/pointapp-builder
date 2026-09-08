import { z } from 'zod';
import { AppManifestSchema } from './manifest';

export const UnsignedReleaseSchema = z.strictObject({
  contractVersion: z.literal(1),
  releaseId: z.uuid(),
  revisionId: z.uuid(),
  manifestDigest: z.string().regex(/^[a-f0-9]{64}$/),
  releasedAt: z.iso.datetime(),
  compatibility: z.strictObject({
    manifestSchema: z.literal(1),
    minimumClientContract: z.number().int().min(1).max(100),
  }),
  manifest: AppManifestSchema,
});
export const ReleaseEnvelopeSchema = UnsignedReleaseSchema.extend({
  signing: z.strictObject({
    algorithm: z.literal('Ed25519'),
    keyId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
    signature: z.string().regex(/^[A-Za-z0-9_-]+$/),
  }),
});
export type UnsignedRelease = z.infer<typeof UnsignedReleaseSchema>;
export type ReleaseEnvelope = z.infer<typeof ReleaseEnvelopeSchema>;
