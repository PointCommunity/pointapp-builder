import { exportPublicJwk, importPrivateJwk, signCanonicalJson } from '../../content/crypto';
import type { ReleaseEnvelope, UnsignedRelease } from '../../content/release';
import { validateManifestRevision } from '../../content/validation';
import { appendAuditEvent } from '../audit';
import { ProblemError } from '../problems';
import { listMedia } from '../repositories/media';
import {
  currentChannel,
  findRelease,
  pointChannel,
  requireRevisionRecord,
  storeStagingRelease,
} from '../repositories/releases';
import type { Membership } from '../repositories/memberships';

export interface ReleaseSigner {
  keyId: string;
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
}
export async function signerFromEnvironment(
  keyId: string,
  privateJwk: string,
  publicJwk: string,
): Promise<ReleaseSigner> {
  try {
    const parsedPrivate = JSON.parse(privateJwk) as JsonWebKey;
    const parsedPublic = JSON.parse(publicJwk) as JsonWebKey;
    if (
      parsedPrivate.kty !== 'OKP' ||
      parsedPrivate.crv !== 'Ed25519' ||
      !parsedPrivate.d ||
      !parsedPrivate.x ||
      parsedPublic.kty !== 'OKP' ||
      parsedPublic.crv !== 'Ed25519' ||
      parsedPublic.x !== parsedPrivate.x ||
      parsedPublic.d
    )
      throw new Error('Invalid Ed25519 signing pair');
    return {
      keyId,
      privateKey: await importPrivateJwk(parsedPrivate),
      publicJwk: parsedPublic,
    };
  } catch {
    throw new ProblemError(503, 'SIGNING_UNAVAILABLE', 'Release signing is unavailable');
  }
}
export async function generatedSigner(keyId = 'local-development'): Promise<ReleaseSigner> {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return { keyId, privateKey: pair.privateKey, publicJwk: await exportPublicJwk(pair.publicKey) };
}

export async function validateRevision(database: D1Database, revisionId: string) {
  const revision = await requireRevisionRecord(database, revisionId);
  return validateManifestRevision(revisionId, revision.manifest, await listMedia(database));
}
export async function publishStaging(
  database: D1Database,
  input: { revisionId: string; actor: Membership; requestId: string; signer: ReleaseSigner },
) {
  const revision = await requireRevisionRecord(database, input.revisionId);
  const report = await validateManifestRevision(
    revision.id,
    revision.manifest,
    await listMedia(database),
  );
  if (!report.valid)
    throw new ProblemError(
      400,
      'RELEASE_VALIDATION_FAILED',
      'Resolve release validation errors before publishing',
      { issues: report.issues.map((issue) => `${issue.path}: ${issue.message}`) },
    );
  const existingReleaseId = await findRelease(
    database,
    revision.id,
    report.manifestDigest,
    input.signer.keyId,
  );
  if (existingReleaseId) {
    return pointChannel(database, {
      channel: 'staging',
      kind: 'publish',
      releaseId: existingReleaseId,
      actorId: input.actor.githubUserId,
    });
  }
  const unsigned: UnsignedRelease = {
    contractVersion: 1,
    releaseId: crypto.randomUUID(),
    revisionId: revision.id,
    manifestDigest: report.manifestDigest,
    releasedAt: new Date().toISOString(),
    compatibility: {
      manifestSchema: 1,
      minimumClientContract: revision.manifest.settings.minimumClientContract,
    },
    manifest: revision.manifest,
  };
  const envelope: ReleaseEnvelope = {
    ...unsigned,
    signing: {
      algorithm: 'Ed25519',
      keyId: input.signer.keyId,
      signature: await signCanonicalJson(input.signer.privateKey, unsigned),
    },
  };
  const view = await storeStagingRelease(database, {
    envelope,
    validationDigest: report.reportDigest,
    publicJwk: input.signer.publicJwk,
    keyId: input.signer.keyId,
    actorId: input.actor.githubUserId,
  });
  await appendAuditEvent(database, {
    id: crypto.randomUUID(),
    requestId: input.requestId,
    actor: input.actor,
    action: 'release.publish-staging',
    targetType: 'release',
    targetId: view.releaseId,
    outcome: 'succeeded',
    metadata: { manifestDigest: view.manifestDigest },
  });
  return view;
}
export async function promoteProduction(
  database: D1Database,
  input: { stagingReleaseId: string; actor: Membership; requestId: string },
) {
  const staging = await currentChannel(database, 'staging');
  if (!staging || staging.releaseId !== input.stagingReleaseId)
    throw new ProblemError(
      409,
      'STAGING_CANDIDATE_CHANGED',
      'Staging changed; verify the current exact candidate',
    );
  const view = await pointChannel(database, {
    channel: 'production',
    kind: 'promote',
    releaseId: staging.releaseId,
    actorId: input.actor.githubUserId,
  });
  await appendAuditEvent(database, {
    id: crypto.randomUUID(),
    requestId: input.requestId,
    actor: input.actor,
    action: 'release.promote-production',
    targetType: 'release',
    targetId: view.releaseId,
    outcome: 'succeeded',
    metadata: { manifestDigest: view.manifestDigest },
  });
  return view;
}
export async function rollbackProduction(
  database: D1Database,
  input: { releaseId: string; reason: string; actor: Membership; requestId: string },
) {
  const prior = await database
    .prepare(
      "SELECT 1 AS ok FROM channel_events WHERE channel = 'production' AND release_id = ? LIMIT 1",
    )
    .bind(input.releaseId)
    .first();
  if (!prior)
    throw new ProblemError(409, 'ROLLBACK_TARGET_INVALID', 'Choose a prior Production release');
  const current = await currentChannel(database, 'production');
  if (current?.releaseId === input.releaseId)
    throw new ProblemError(409, 'ROLLBACK_TARGET_CURRENT', 'Production already uses this release');
  const view = await pointChannel(database, {
    channel: 'production',
    kind: 'rollback',
    releaseId: input.releaseId,
    actorId: input.actor.githubUserId,
    reason: input.reason,
  });
  await appendAuditEvent(database, {
    id: crypto.randomUUID(),
    requestId: input.requestId,
    actor: input.actor,
    action: 'release.rollback-production',
    targetType: 'release',
    targetId: view.releaseId,
    outcome: 'succeeded',
    reason: input.reason,
    metadata: { manifestDigest: view.manifestDigest },
  });
  return view;
}
