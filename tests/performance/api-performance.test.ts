// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { registerIdentity } from '../../src/server/repositories/memberships';
import { requireDraft } from '../../src/server/repositories/drafts';
import { createDraft, saveDraftRevision } from '../../src/server/services/drafts';
import { SQLiteD1Database } from '../helpers/sqlite-d1';

const p95 = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length * 0.95)];
describe('deterministic API performance targets', () => {
  it('keeps draft reads under 100 ms p95 and saves under 250 ms p95', async () => {
    const db = new SQLiteD1Database();
    db.applyMigrations();
    const actor = await registerIdentity(
      db,
      { id: 1_202_831, login: 'brimdor', displayName: null, avatarUrl: null },
      '1202831',
    );
    let draft = await createDraft(db, {
      name: 'Performance',
      actor,
      requestId: crypto.randomUUID(),
    });
    const reads: number[] = [];
    const saves: number[] = [];
    for (let index = 0; index < 30; index += 1) {
      const started = performance.now();
      await requireDraft(db, draft.id);
      reads.push(performance.now() - started);
    }
    for (let index = 0; index < 10; index += 1) {
      const manifest = structuredClone(draft.manifest);
      manifest.app.tagline = `Performance revision ${index}`;
      const started = performance.now();
      draft = await saveDraftRevision(db, {
        draftId: draft.id,
        expectedParentRevisionId: draft.currentRevision.id,
        label: `Save ${index}`,
        manifest,
        actor,
        requestId: crypto.randomUUID(),
      });
      saves.push(performance.now() - started);
    }
    expect(p95(reads)).toBeLessThan(100);
    expect(p95(saves)).toBeLessThan(250);
  });
});
