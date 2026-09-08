import type { AppManifest } from '../../content/manifest';
import type { ReleaseEnvelope } from '../../content/release';
import { parseStoredJson } from '../d1';
import { ProblemError } from '../problems';

export interface RevisionRecord {
  id: string;
  manifest: AppManifest;
  checksum: string;
}
export interface ReleaseView {
  eventId: string;
  channel: 'staging' | 'production';
  eventKind: 'publish' | 'promote' | 'rollback';
  releaseId: string;
  revisionId: string;
  manifestDigest: string;
  keyId: string;
  signature: string;
  createdAt: string;
}
interface ReleaseRow {
  event_id: string;
  channel: ReleaseView['channel'];
  kind: ReleaseView['eventKind'];
  release_id: string;
  revision_id: string;
  manifest_digest: string;
  key_id: string;
  signature: string;
  created_at: string;
}
const mapView = (row: ReleaseRow): ReleaseView => ({
  eventId: row.event_id,
  channel: row.channel,
  eventKind: row.kind,
  releaseId: row.release_id,
  revisionId: row.revision_id,
  manifestDigest: row.manifest_digest,
  keyId: row.key_id,
  signature: row.signature,
  createdAt: row.created_at,
});
const viewSql = `SELECT e.id AS event_id, e.channel, e.kind, e.release_id, r.revision_id,
  r.manifest_digest, r.key_id, r.signature, e.created_at FROM channel_events e
  JOIN release_envelopes r ON r.id = e.release_id`;

export async function requireRevisionRecord(
  database: D1Database,
  id: string,
): Promise<RevisionRecord> {
  const row = await database
    .prepare('SELECT id, manifest_json, checksum FROM manifest_revisions WHERE id = ?')
    .bind(id)
    .first<{ id: string; manifest_json: string; checksum: string }>();
  if (!row) throw new ProblemError(404, 'REVISION_NOT_FOUND', 'The saved revision does not exist');
  return {
    id: row.id,
    manifest: parseStoredJson<AppManifest>(row.manifest_json),
    checksum: row.checksum,
  };
}
export async function currentChannel(
  database: D1Database,
  channel: ReleaseView['channel'],
): Promise<ReleaseView | null> {
  const row = await database
    .prepare(`${viewSql} JOIN channel_pointers p ON p.event_id = e.id WHERE p.channel = ?`)
    .bind(channel)
    .first<ReleaseRow>();
  return row ? mapView(row) : null;
}
export async function listReleaseHistory(database: D1Database): Promise<ReleaseView[]> {
  const result = await database
    .prepare(`${viewSql} ORDER BY e.created_at DESC, e.id DESC LIMIT 100`)
    .all<ReleaseRow>();
  return result.results.map(mapView);
}
export async function storeStagingRelease(
  database: D1Database,
  input: {
    envelope: ReleaseEnvelope;
    validationDigest: string;
    publicJwk: JsonWebKey;
    keyId: string;
    actorId: string;
  },
): Promise<ReleaseView> {
  const existingKey = await database
    .prepare('SELECT public_jwk FROM signing_keys WHERE key_id = ?')
    .bind(input.keyId)
    .first<{ public_jwk: string }>();
  if (existingKey && existingKey.public_jwk !== JSON.stringify(input.publicJwk)) {
    throw new ProblemError(
      409,
      'SIGNING_KEY_CONFLICT',
      'The signing key identifier is already in use',
    );
  }
  const eventId = crypto.randomUUID();
  const now = input.envelope.releasedAt;
  await database.batch([
    database
      .prepare(
        `INSERT OR IGNORE INTO signing_keys (key_id, algorithm, public_jwk, created_at) VALUES (?, 'Ed25519', ?, ?)`,
      )
      .bind(input.keyId, JSON.stringify(input.publicJwk), now),
    database
      .prepare(
        `INSERT INTO release_envelopes (id, revision_id, manifest_json, manifest_digest, validation_digest, key_id, algorithm, signature, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Ed25519', ?, ?, ?)`,
      )
      .bind(
        input.envelope.releaseId,
        input.envelope.revisionId,
        JSON.stringify(input.envelope.manifest),
        input.envelope.manifestDigest,
        input.validationDigest,
        input.keyId,
        input.envelope.signing.signature,
        input.actorId,
        now,
      ),
    database
      .prepare(
        `INSERT INTO channel_events (id, channel, kind, release_id, prior_event_id, created_by, created_at)
      VALUES (?, 'staging', 'publish', ?, (SELECT event_id FROM channel_pointers WHERE channel = 'staging'), ?, ?)`,
      )
      .bind(eventId, input.envelope.releaseId, input.actorId, now),
    database
      .prepare(
        `INSERT INTO channel_pointers (channel, event_id, release_id, version, updated_at) VALUES ('staging', ?, ?, 1, ?)
      ON CONFLICT(channel) DO UPDATE SET event_id = excluded.event_id, release_id = excluded.release_id, version = channel_pointers.version + 1, updated_at = excluded.updated_at`,
      )
      .bind(eventId, input.envelope.releaseId, now),
  ]);
  return (await currentChannel(database, 'staging'))!;
}
export async function pointChannel(
  database: D1Database,
  input: {
    channel: 'staging' | 'production';
    kind: 'publish' | 'promote' | 'rollback';
    releaseId: string;
    actorId: string;
    reason?: string;
  },
): Promise<ReleaseView> {
  const release = await database
    .prepare('SELECT id FROM release_envelopes WHERE id = ?')
    .bind(input.releaseId)
    .first();
  if (!release) throw new ProblemError(404, 'RELEASE_NOT_FOUND', 'The release does not exist');
  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();
  await database.batch([
    database
      .prepare(
        `INSERT INTO channel_events (id, channel, kind, release_id, prior_event_id, reason, created_by, created_at)
      VALUES (?, ?, ?, ?, (SELECT event_id FROM channel_pointers WHERE channel = ?), ?, ?, ?)`,
      )
      .bind(
        eventId,
        input.channel,
        input.kind,
        input.releaseId,
        input.channel,
        input.reason ?? null,
        input.actorId,
        now,
      ),
    database
      .prepare(
        `INSERT INTO channel_pointers (channel, event_id, release_id, version, updated_at) VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(channel) DO UPDATE SET event_id = excluded.event_id, release_id = excluded.release_id, version = channel_pointers.version + 1, updated_at = excluded.updated_at`,
      )
      .bind(input.channel, eventId, input.releaseId, now),
  ]);
  return (await currentChannel(database, input.channel))!;
}
export async function findRelease(
  database: D1Database,
  revisionId: string,
  manifestDigest: string,
  keyId: string,
): Promise<string | null> {
  const row = await database
    .prepare(
      'SELECT id FROM release_envelopes WHERE revision_id = ? AND manifest_digest = ? AND key_id = ?',
    )
    .bind(revisionId, manifestDigest, keyId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function publicEnvelope(database: D1Database): Promise<ReleaseEnvelope | null> {
  const row = await database
    .prepare(
      `SELECT r.id, r.revision_id, r.manifest_json, r.manifest_digest, r.key_id, r.signature, r.created_at
    FROM channel_pointers p JOIN release_envelopes r ON r.id = p.release_id WHERE p.channel = 'production'`,
    )
    .first<{
      id: string;
      revision_id: string;
      manifest_json: string;
      manifest_digest: string;
      key_id: string;
      signature: string;
      created_at: string;
    }>();
  if (!row) return null;
  const manifest = parseStoredJson<AppManifest>(row.manifest_json);
  return {
    contractVersion: 1,
    releaseId: row.id,
    revisionId: row.revision_id,
    manifestDigest: row.manifest_digest,
    releasedAt: row.created_at,
    compatibility: {
      manifestSchema: 1,
      minimumClientContract: manifest.settings.minimumClientContract,
    },
    manifest,
    signing: { algorithm: 'Ed25519', keyId: row.key_id, signature: row.signature },
  };
}
