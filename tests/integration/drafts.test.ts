// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sampleManifest } from '../../src/content/manifest';
import { registerIdentity } from '../../src/server/repositories/memberships';
import { listRevisions } from '../../src/server/repositories/drafts';
import { changeDraft, createDraft, saveDraftRevision } from '../../src/server/services/drafts';
import { SQLiteD1Database } from '../helpers/sqlite-d1';

async function fixture() {
  const db = new SQLiteD1Database();
  db.applyMigrations();
  const actor = await registerIdentity(
    db,
    { id: 1_202_831, login: 'brimdor', displayName: null, avatarUrl: null },
    '1202831',
  );
  return { db, actor };
}
describe('durable drafts', () => {
  it('creates, duplicates, archives, recovers, and preserves immutable history', async () => {
    const { db, actor } = await fixture();
    const first = await createDraft(db, {
      name: 'Main app',
      actor,
      requestId: crypto.randomUUID(),
    });
    const changed = structuredClone(first.manifest);
    changed.app.tagline = 'Saved change';
    const saved = await saveDraftRevision(db, {
      draftId: first.id,
      expectedParentRevisionId: first.currentRevision.id,
      label: 'Change tagline',
      manifest: changed,
      actor,
      requestId: crypto.randomUUID(),
    });
    expect(saved.currentRevision.sequence).toBe(2);
    expect(await listRevisions(db, first.id)).toHaveLength(2);
    const archived = await changeDraft(db, {
      draftId: first.id,
      expectedVersion: saved.version,
      state: 'archived',
      actor,
      requestId: crypto.randomUUID(),
    });
    const recovered = await changeDraft(db, {
      draftId: first.id,
      expectedVersion: archived.version,
      state: 'active',
      actor,
      requestId: crypto.randomUUID(),
    });
    expect(recovered.state).toBe('active');
    const copy = await createDraft(db, {
      name: 'Copy',
      duplicateRevisionId: saved.currentRevision.id,
      actor,
      requestId: crypto.randomUUID(),
    });
    expect(copy.manifest.app.tagline).toBe('Saved change');
  });
  it('rejects a stale parent without overwriting current history', async () => {
    const { db, actor } = await fixture();
    const draft = await createDraft(db, {
      name: 'Main app',
      actor,
      requestId: crypto.randomUUID(),
    });
    await saveDraftRevision(db, {
      draftId: draft.id,
      expectedParentRevisionId: draft.currentRevision.id,
      label: 'First save',
      manifest: sampleManifest,
      actor,
      requestId: crypto.randomUUID(),
    });
    await expect(
      saveDraftRevision(db, {
        draftId: draft.id,
        expectedParentRevisionId: draft.currentRevision.id,
        label: 'Stale save',
        manifest: sampleManifest,
        actor,
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'STALE_DRAFT_PARENT' });
    expect(await listRevisions(db, draft.id)).toHaveLength(2);
  });
  it('database triggers reject revision update and delete', async () => {
    const { db, actor } = await fixture();
    const draft = await createDraft(db, {
      name: 'Main app',
      actor,
      requestId: crypto.randomUUID(),
    });
    expect(() =>
      db.database
        .prepare('UPDATE manifest_revisions SET label = ? WHERE id = ?')
        .run('Changed', draft.currentRevision.id),
    ).toThrow(/immutable/);
    expect(() =>
      db.database
        .prepare('DELETE FROM manifest_revisions WHERE id = ?')
        .run(draft.currentRevision.id),
    ).toThrow(/immutable/);
  });
  it('enforces settings authority on the server', async () => {
    const { db, actor } = await fixture();
    const editor = await registerIdentity(
      db,
      { id: 2, login: 'editor', displayName: null, avatarUrl: null },
      '1202831',
    );
    db.database
      .prepare("UPDATE memberships SET status = 'active' WHERE github_user_id = '2'")
      .run();
    const activeEditor = { ...editor, status: 'active' as const };
    const draft = await createDraft(db, {
      name: 'Governed',
      actor,
      requestId: crypto.randomUUID(),
    });
    const changed = structuredClone(draft.manifest);
    changed.settings.refreshSeconds = 120;
    await expect(
      saveDraftRevision(db, {
        draftId: draft.id,
        expectedParentRevisionId: draft.currentRevision.id,
        label: 'Unauthorized settings',
        manifest: changed,
        actor: activeEditor,
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 403, code: 'SETTINGS_FORBIDDEN' });
  });
});
