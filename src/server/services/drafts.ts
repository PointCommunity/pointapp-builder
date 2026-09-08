import { AppManifestSchema, sampleManifest, type AppManifest } from '../../content/manifest';
import { digestCanonicalJson } from '../../content/crypto';
import { can } from '../../domain/access';
import { appendAuditEvent } from '../audit';
import { ProblemError } from '../problems';
import {
  createDraftRecord,
  requireDraft,
  saveRevisionRecord,
  updateDraftRecord,
} from '../repositories/drafts';
import type { Membership } from '../repositories/memberships';

export async function createDraft(
  database: D1Database,
  input: { name: string; duplicateRevisionId?: string; actor: Membership; requestId: string },
) {
  let manifest: AppManifest = structuredClone(sampleManifest);
  if (input.duplicateRevisionId) {
    const row = await database
      .prepare('SELECT manifest_json FROM manifest_revisions WHERE id = ?')
      .bind(input.duplicateRevisionId)
      .first<{ manifest_json: string }>();
    if (!row)
      throw new ProblemError(404, 'REVISION_NOT_FOUND', 'The revision to duplicate does not exist');
    manifest = AppManifestSchema.parse(JSON.parse(row.manifest_json));
  }
  const id = crypto.randomUUID();
  const draft = await createDraftRecord(database, {
    id,
    revisionId: crypto.randomUUID(),
    name: input.name,
    actorId: input.actor.githubUserId,
    manifest,
    checksum: await digestCanonicalJson(manifest),
    label: 'Initial revision',
  });
  await appendAuditEvent(database, {
    id: crypto.randomUUID(),
    requestId: input.requestId,
    actor: input.actor,
    action: 'draft.create',
    targetType: 'draft',
    targetId: id,
    outcome: 'succeeded',
  });
  return draft;
}

export async function saveDraftRevision(
  database: D1Database,
  input: {
    draftId: string;
    expectedParentRevisionId: string;
    label: string;
    manifest: unknown;
    actor: Membership;
    requestId: string;
  },
) {
  const manifest = AppManifestSchema.parse(input.manifest);
  const current = await requireDraft(database, input.draftId);
  const settingsChanged =
    JSON.stringify(current.manifest.settings) !== JSON.stringify(manifest.settings);
  if (settingsChanged && !can(input.actor, 'settings:manage')) {
    throw new ProblemError(
      403,
      'SETTINGS_FORBIDDEN',
      'Only Administrators and Owners may change app settings',
    );
  }
  const draft = await saveRevisionRecord(database, {
    draftId: input.draftId,
    revisionId: crypto.randomUUID(),
    expectedParentId: input.expectedParentRevisionId,
    actorId: input.actor.githubUserId,
    manifest,
    checksum: await digestCanonicalJson(manifest),
    label: input.label,
  });
  await appendAuditEvent(database, {
    id: crypto.randomUUID(),
    requestId: input.requestId,
    actor: input.actor,
    action: 'draft.save',
    targetType: 'revision',
    targetId: draft.currentRevision.id,
    outcome: 'succeeded',
    metadata: { draftId: input.draftId, sequence: draft.currentRevision.sequence },
  });
  if (settingsChanged)
    await appendAuditEvent(database, {
      id: crypto.randomUUID(),
      requestId: input.requestId,
      actor: input.actor,
      action: 'settings.update',
      targetType: 'draft',
      targetId: input.draftId,
      outcome: 'succeeded',
    });
  return draft;
}

export async function changeDraft(
  database: D1Database,
  input: {
    draftId: string;
    expectedVersion: number;
    name?: string;
    state?: 'active' | 'archived';
    actor: Membership;
    requestId: string;
  },
) {
  await requireDraft(database, input.draftId);
  const draft = await updateDraftRecord(database, {
    ...input,
    id: input.draftId,
    actorId: input.actor.githubUserId,
  });
  await appendAuditEvent(database, {
    id: crypto.randomUUID(),
    requestId: input.requestId,
    actor: input.actor,
    action:
      input.state === 'archived'
        ? 'draft.archive'
        : input.state === 'active'
          ? 'draft.recover'
          : 'draft.rename',
    targetType: 'draft',
    targetId: input.draftId,
    outcome: 'succeeded',
  });
  return draft;
}
