import { ProblemError } from '../problems';

interface MediaRow {
  id: string;
  kind: 'image' | 'audio' | 'video';
  state: 'ready' | 'archived';
  title: string;
  filename: string | null;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  alt_text: string | null;
  caption_url: string | null;
  external_url: string | null;
  sha256: string;
  created_at: string;
}
export interface MediaAsset {
  id: string;
  kind: MediaRow['kind'];
  state: MediaRow['state'];
  title: string;
  filename: string | null;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  altText: string | null;
  captionUrl: string | null;
  externalUrl: string | null;
  sha256: string;
  createdAt: string;
}
const map = (row: MediaRow): MediaAsset => ({
  id: row.id,
  kind: row.kind,
  state: row.state,
  title: row.title,
  filename: row.filename,
  mimeType: row.mime_type,
  byteSize: row.byte_size,
  width: row.width,
  height: row.height,
  durationSeconds: row.duration_seconds,
  altText: row.alt_text,
  captionUrl: row.caption_url,
  externalUrl: row.external_url,
  sha256: row.sha256,
  createdAt: row.created_at,
});
const columns =
  'id, kind, state, title, filename, mime_type, byte_size, width, height, duration_seconds, alt_text, caption_url, external_url, sha256, created_at';

export async function listMedia(database: D1Database): Promise<MediaAsset[]> {
  const result = await database
    .prepare(`SELECT ${columns} FROM media_assets ORDER BY created_at DESC LIMIT 100`)
    .all<MediaRow>();
  return result.results.map(map);
}
export async function getMedia(database: D1Database, id: string): Promise<MediaAsset | null> {
  const row = await database
    .prepare(`SELECT ${columns} FROM media_assets WHERE id = ?`)
    .bind(id)
    .first<MediaRow>();
  return row ? map(row) : null;
}
export async function requireMedia(database: D1Database, id: string): Promise<MediaAsset> {
  const asset = await getMedia(database, id);
  if (!asset) throw new ProblemError(404, 'MEDIA_NOT_FOUND', 'The media asset does not exist');
  return asset;
}
export async function createMediaRecord(
  database: D1Database,
  asset: MediaAsset,
  actorId: string,
  chunks: Uint8Array[],
) {
  const statements = [
    database
      .prepare(
        `INSERT INTO media_assets
    (id, kind, state, title, filename, mime_type, byte_size, width, height, duration_seconds, alt_text, caption_url, external_url, sha256, created_by, created_at)
    VALUES (?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        asset.id,
        asset.kind,
        asset.title,
        asset.filename,
        asset.mimeType,
        asset.byteSize,
        asset.width,
        asset.height,
        asset.durationSeconds,
        asset.altText,
        asset.captionUrl,
        asset.externalUrl,
        asset.sha256,
        actorId,
        asset.createdAt,
      ),
    ...chunks.map((chunk, index) =>
      database
        .prepare(
          'INSERT INTO media_chunks (media_id, chunk_index, byte_length, payload) VALUES (?, ?, ?, ?)',
        )
        .bind(asset.id, index, chunk.byteLength, chunk),
    ),
  ];
  await database.batch(statements);
  return asset;
}
export async function readMediaBytes(database: D1Database, id: string): Promise<Uint8Array> {
  const result = await database
    .prepare('SELECT payload FROM media_chunks WHERE media_id = ? ORDER BY chunk_index')
    .bind(id)
    .all<{ payload: ArrayBuffer | Uint8Array }>();
  const chunks = result.results.map((row) =>
    row.payload instanceof Uint8Array ? row.payload : new Uint8Array(row.payload),
  );
  const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function updateMediaState(
  database: D1Database,
  id: string,
  state: 'ready' | 'archived',
  actorId: string,
): Promise<MediaAsset> {
  const result = await database
    .prepare(
      `UPDATE media_assets SET state = ?, archived_by = CASE WHEN ? = 'archived' THEN ? ELSE NULL END,
       archived_at = CASE WHEN ? = 'archived' THEN ? ELSE NULL END WHERE id = ?`,
    )
    .bind(state, state, actorId, state, new Date().toISOString(), id)
    .run();
  if ((result.meta.changes ?? 0) !== 1)
    throw new ProblemError(404, 'MEDIA_NOT_FOUND', 'The media asset does not exist');
  return requireMedia(database, id);
}
