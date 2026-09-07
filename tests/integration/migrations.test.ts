// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function migrationFiles() {
  const directory = resolve('migrations');
  return readdirSync(directory)
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort()
    .map((file) => ({ file, sql: readFileSync(resolve(directory, file), 'utf8') }));
}

describe('D1 migrations', () => {
  it('apply in order to an empty SQLite database and preserve foreign-key integrity', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');

    for (const migration of migrationFiles()) database.exec(migration.sql);

    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((row) => row.name);
    expect(tables).toEqual([
      'audit_events',
      'channel_events',
      'channel_pointers',
      'drafts',
      'idempotency_records',
      'manifest_revisions',
      'media_assets',
      'media_chunks',
      'memberships',
      'release_envelopes',
      'signing_keys',
    ]);
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('enforces role status channel and append-only revision constraints', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    for (const migration of migrationFiles()) database.exec(migration.sql);

    expect(() =>
      database
        .prepare(
          'INSERT INTO memberships (github_user_id, login, role, status) VALUES (?, ?, ?, ?)',
        )
        .run('1', 'member', 'super-admin', 'active'),
    ).toThrow();

    database
      .prepare('INSERT INTO memberships (github_user_id, login, role, status) VALUES (?, ?, ?, ?)')
      .run('1', 'member', 'owner', 'active');
    database
      .prepare('INSERT INTO drafts (id, name, state, version, created_by) VALUES (?, ?, ?, ?, ?)')
      .run('d-1', 'Primary', 'active', 1, '1');
    database
      .prepare(
        'INSERT INTO manifest_revisions (id, draft_id, sequence, manifest_json, checksum, schema_version, label, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run('r-1', 'd-1', 1, '{}', 'a'.repeat(64), 1, 'Initial', '1');

    expect(() =>
      database.prepare("UPDATE manifest_revisions SET label = 'Changed' WHERE id = 'r-1'").run(),
    ).toThrow(/immutable/i);
    expect(() => database.prepare("DELETE FROM manifest_revisions WHERE id = 'r-1'").run()).toThrow(
      /immutable/i,
    );
  });
});
