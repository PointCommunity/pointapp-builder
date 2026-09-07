import { z } from 'zod';
import { AppManifestSchema } from './manifest';

export const ReleaseEnvelopeSchema = z
  .strictObject({
    envelopeVersion: z.literal(1),
    releasedAt: z.iso.datetime(),
    manifest: AppManifestSchema,
    integrity: z.strictObject({
      algorithm: z.literal('ed25519-sha256'),
      digest: z.string().regex(/^[a-f0-9]{64}$/),
      signature: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/),
      keyId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,80}$/),
    }),
  })
  .superRefine((release, context) => {
    if (release.manifest.channel === 'draft') {
      context.addIssue({
        code: 'custom',
        path: ['manifest', 'channel'],
        message: 'Installed apps may receive Staging or Production releases, not Draft',
      });
    }
  });

export type ReleaseEnvelope = z.infer<typeof ReleaseEnvelopeSchema>;
