import type { AppManifest } from '../../content/manifest';
import { parseStoredJson } from '../d1';
import { ProblemError } from '../problems';

interface DraftRow {
  id: string;
  name: string;
  state: 'active' | 'archived';
  version: number;
  current_revision_id: string;
  updated_at: string;
  manifest_json: string;
  revision_sequence: number;
  checksum: string;
  schema_version: number;
  revision_label: string;
  revision_created_by: string;
  revision_created_at: string;
  parent_revision_id: string | null;
}

export interface RevisionSummary {
  id: string;
  draftId: string;
  parentRevisionId: string | null;
  sequence: number;
  checksum: string;
  schemaVersion: number;
  label: string;
  createdBy: string;
  createdAt: string;
}

export interface DraftDetail {
  id: string;
  name: string;
  state: 'active' | 'archived';
  version: number;
  currentRevision: RevisionSummary;
  updatedAt: string;
  manifest: AppManifest;
}

function mapRow(row: DraftRow): DraftDetail {
  return {
    id: row.id,
    name: row.name,
    state: row.state,
    version: row.version,
    currentRevision: {
      id: row.current_revision_id,
      draftId: row.id,
      parentRevisionId: row.parent_revision_id,
      sequence: row.revision_sequence,
      checksum: row.checksum,
      schemaVersion: row.schema_version,
      label: row.revision_label,
      createdBy: row.revision_created_by,
      createdAt: row.revision_created_at,
    },
    updatedAt: row.updated_at,
    manifest: parseStoredJson<AppManifest>(row.manifest_json),
  };
}

const detailSql = `SELECT d.id, d.name, d.state, d.version, d.current_revision_id, d.updated_at,
  r.manifest_json, r.sequence AS revision_sequence, r.checksum, r.schema_version,
  r.label AS revision_label, r.created_by AS revision_created_by,
  r.created_at AS revision_created_at, r.parent_revision_id
  FROM drafts d JOIN manifest_revisions r ON r.id = d.current_revision_id`;

export async function getDraft(database: D1Database, id: string): Promise<DraftDetail | null> {
  const row = await database.prepare(`${detailSql} WHERE d.id = ?`).bind(id).first<DraftRow>();
  return row ? mapRow(row) : null;
}

export async function requireDraft(database: D1Database, id: string): Promise<DraftDetail> {
  const draft = await getDraft(database, id);
  if (!draft) throw new ProblemError(404, 'DRAFT_NOT_FOUND', 'The draft does not exist');
  return draft;
}

export async function listDrafts(
  database: D1Database,
  includeArchived = false,
): Promise<DraftDetail[]> {
  const result = await database
    .prepare(
      `${detailSql} ${includeArchived ? '' : "WHERE d.state = 'active'"} ORDER BY d.updated_at DESC LIMIT 100`,
    )
    .all<DraftRow>();
  return result.results.map(mapRow);
}

export async function listRevisions(
  database: D1Database,
  draftId: string,
): Promise<RevisionSummary[]> {
  const result = await database
    .prepare(
      `SELECT id, draft_id, parent_revision_id, sequence, checksum, schema_version, label,
      created_by, created_at FROM manifest_revisions WHERE draft_id = ? ORDER BY sequence DESC LIMIT 100`,
    )
    .bind(draftId)
    .all<{
      id: string;
      draft_id: string;
      parent_revision_id: string | null;
      sequence: number;
      checksum: string;
      schema_version: number;
      label: string;
      created_by: string;
      created_at: string;
    }>();
  return result.results.map((row) => ({
    id: row.id,
    draftId: row.draft_id,
    parentRevisionId: row.parent_revision_id,
    sequence: row.sequence,
    checksum: row.checksum,
    schemaVersion: row.schema_version,
    label: row.label,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

export async function createDraftRecord(
  database: D1Database,
  input: {
    id: string;
    revisionId: string;
    name: string;
    actorId: string;
    manifest: AppManifest;
    checksum: string;
    label: string;
  },
): Promise<DraftDetail> {
  const now = new Date().toISOString();
  await database.batch([
    database
      .prepare(
        `INSERT INTO drafts (id, name, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(input.id, input.name, input.actorId, input.actorId, now, now),
    database
      .prepare(
        `INSERT INTO manifest_revisions
      (id, draft_id, parent_revision_id, sequence, manifest_json, checksum, schema_version, label, created_by, created_at)
      VALUES (?, ?, NULL, 1, ?, ?, 1, ?, ?, ?)`,
      )
      .bind(
        input.revisionId,
        input.id,
        JSON.stringify(input.manifest),
        input.checksum,
        input.label,
        input.actorId,
        now,
      ),
    database
      .prepare('UPDATE drafts SET current_revision_id = ? WHERE id = ?')
      .bind(input.revisionId, input.id),
  ]);
  return requireDraft(database, input.id);
}

export async function saveRevisionRecord(
  database: D1Database,
  input: {
    draftId: string;
    revisionId: string;
    expectedParentId: string;
    actorId: string;
    manifest: AppManifest;
    checksum: string;
    label: string;
  },
): Promise<DraftDetail> {
  const now = new Date().toISOString();
  const results = await database.batch([
    database
      .prepare(
        `INSERT INTO manifest_revisions
      (id, draft_id, parent_revision_id, sequence, manifest_json, checksum, schema_version, label, created_by, created_at)
      SELECT ?, d.id, d.current_revision_id,
        COALESCE((SELECT MAX(sequence) FROM manifest_revisions WHERE draft_id = d.id), 0) + 1,
        ?, ?, 1, ?, ?, ? FROM drafts d
      WHERE d.id = ? AND d.state = 'active' AND d.current_revision_id = ?`,
      )
      .bind(
        input.revisionId,
        JSON.stringify(input.manifest),
        input.checksum,
        input.label,
        input.actorId,
        now,
        input.draftId,
        input.expectedParentId,
      ),
    database
      .prepare(
        `UPDATE drafts SET current_revision_id = ?, version = version + 1,
      updated_by = ?, updated_at = ? WHERE id = ? AND current_revision_id = ?
      AND EXISTS (SELECT 1 FROM manifest_revisions WHERE id = ?)`,
      )
      .bind(
        input.revisionId,
        input.actorId,
        now,
        input.draftId,
        input.expectedParentId,
        input.revisionId,
      ),
  ]);
  if ((results[0].meta.changes ?? 0) !== 1 || (results[1].meta.changes ?? 0) !== 1) {
    throw new ProblemError(409, 'STALE_DRAFT_PARENT', 'The draft changed; reload before saving');
  }
  return requireDraft(database, input.draftId);
}

export async function updateDraftRecord(
  database: D1Database,
  input: {
    id: string;
    expectedVersion: number;
    name?: string;
    state?: 'active' | 'archived';
    actorId: string;
  },
): Promise<DraftDetail> {
  const current = await requireDraft(database, input.id);
  const state = input.state ?? current.state;
  const now = new Date().toISOString();
  const result = await database
    .prepare(
      `UPDATE drafts SET name = ?, state = ?, version = version + 1,
    updated_by = ?, updated_at = ?, archived_by = CASE WHEN ? = 'archived' THEN ? ELSE NULL END,
    archived_at = CASE WHEN ? = 'archived' THEN ? ELSE NULL END WHERE id = ? AND version = ?`,
    )
    .bind(
      input.name ?? current.name,
      state,
      input.actorId,
      now,
      state,
      input.actorId,
      state,
      now,
      input.id,
      input.expectedVersion,
    )
    .run();
  if ((result.meta.changes ?? 0) !== 1)
    throw new ProblemError(409, 'DRAFT_CONFLICT', 'The draft changed; reload and try again');
  return requireDraft(database, input.id);
}
