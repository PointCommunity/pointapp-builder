import { listAuditEvents } from '../audit';
import { currentChannel } from './releases';

async function count(database: D1Database, table: string): Promise<number> {
  const allowed = new Set([
    'memberships',
    'drafts',
    'manifest_revisions',
    'media_assets',
    'release_envelopes',
    'audit_events',
  ]);
  if (!allowed.has(table)) return 0;
  const row = await database
    .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
    .first<{ count: number }>();
  return row?.count ?? 0;
}
async function mediaBytes(database: D1Database): Promise<number> {
  const row = await database
    .prepare('SELECT COALESCE(SUM(byte_size), 0) AS bytes FROM media_assets')
    .first<{ bytes: number }>();
  return row?.bytes ?? 0;
}
export async function operationsSnapshot(database: D1Database) {
  const [
    memberships,
    drafts,
    revisions,
    media,
    mediaStorageBytes,
    releases,
    audits,
    staging,
    production,
  ] = await Promise.all([
    count(database, 'memberships'),
    count(database, 'drafts'),
    count(database, 'manifest_revisions'),
    count(database, 'media_assets'),
    mediaBytes(database),
    count(database, 'release_envelopes'),
    count(database, 'audit_events'),
    currentChannel(database, 'staging'),
    currentChannel(database, 'production'),
  ]);
  return {
    channels: { staging, production },
    capacity: { memberships, drafts, revisions, media, mediaStorageBytes, releases, audits },
  };
}
export { listAuditEvents };
