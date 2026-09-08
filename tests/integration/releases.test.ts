// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { verifyCanonicalJson } from '../../src/content/crypto';
import { registerIdentity } from '../../src/server/repositories/memberships';
import { createDraft, saveDraftRevision } from '../../src/server/services/drafts';
import {
  currentChannel,
  listReleaseHistory,
  publicEnvelope,
} from '../../src/server/repositories/releases';
import {
  generatedSigner,
  promoteProduction,
  publishStaging,
  rollbackProduction,
} from '../../src/server/services/releases';
import { SQLiteD1Database } from '../helpers/sqlite-d1';

async function fixture() {
  const db = new SQLiteD1Database();
  db.applyMigrations();
  const actor = await registerIdentity(
    db,
    { id: 1_202_831, login: 'brimdor', displayName: null, avatarUrl: null },
    '1202831',
  );
  const signer = await generatedSigner('test-key');
  const draft = await createDraft(db, { name: 'Release', actor, requestId: crypto.randomUUID() });
  return { db, actor, signer, draft };
}
describe('exact-candidate releases', () => {
  it('signs Staging and promotes the identical release and digest', async () => {
    const { db, actor, signer, draft } = await fixture();
    const staging = await publishStaging(db, {
      revisionId: draft.currentRevision.id,
      actor,
      requestId: crypto.randomUUID(),
      signer,
    });
    const production = await promoteProduction(db, {
      stagingReleaseId: staging.releaseId,
      actor,
      requestId: crypto.randomUUID(),
    });
    expect(production.releaseId).toBe(staging.releaseId);
    expect(production.manifestDigest).toBe(staging.manifestDigest);
    const envelope = (await publicEnvelope(db))!;
    const { signing, ...unsigned } = envelope;
    expect(await verifyCanonicalJson(signer.publicJwk, unsigned, signing.signature)).toBe(true);
  });
  it('rejects promotion after Staging changes', async () => {
    const { db, actor, signer, draft } = await fixture();
    const first = await publishStaging(db, {
      revisionId: draft.currentRevision.id,
      actor,
      requestId: crypto.randomUUID(),
      signer,
    });
    const manifest = structuredClone(draft.manifest);
    manifest.app.tagline = 'Second candidate';
    const next = await saveDraftRevision(db, {
      draftId: draft.id,
      expectedParentRevisionId: draft.currentRevision.id,
      label: 'Second candidate',
      manifest,
      actor,
      requestId: crypto.randomUUID(),
    });
    await publishStaging(db, {
      revisionId: next.currentRevision.id,
      actor,
      requestId: crypto.randomUUID(),
      signer,
    });
    await expect(
      promoteProduction(db, {
        stagingReleaseId: first.releaseId,
        actor,
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'STAGING_CANDIDATE_CHANGED' });
  });
  it('rolls Production back only to a prior Production release', async () => {
    const { db, actor, signer, draft } = await fixture();
    const first = await publishStaging(db, {
      revisionId: draft.currentRevision.id,
      actor,
      requestId: crypto.randomUUID(),
      signer,
    });
    await promoteProduction(db, {
      stagingReleaseId: first.releaseId,
      actor,
      requestId: crypto.randomUUID(),
    });
    const manifest = structuredClone(draft.manifest);
    manifest.app.tagline = 'Second candidate';
    const next = await saveDraftRevision(db, {
      draftId: draft.id,
      expectedParentRevisionId: draft.currentRevision.id,
      label: 'Second candidate',
      manifest,
      actor,
      requestId: crypto.randomUUID(),
    });
    const second = await publishStaging(db, {
      revisionId: next.currentRevision.id,
      actor,
      requestId: crypto.randomUUID(),
      signer,
    });
    await promoteProduction(db, {
      stagingReleaseId: second.releaseId,
      actor,
      requestId: crypto.randomUUID(),
    });
    const rollback = await rollbackProduction(db, {
      releaseId: first.releaseId,
      reason: 'Restore last known good content',
      actor,
      requestId: crypto.randomUUID(),
    });
    expect(rollback).toMatchObject({ releaseId: first.releaseId, eventKind: 'rollback' });
    expect((await currentChannel(db, 'production'))?.releaseId).toBe(first.releaseId);
    expect(await listReleaseHistory(db)).toHaveLength(5);
  });
});
