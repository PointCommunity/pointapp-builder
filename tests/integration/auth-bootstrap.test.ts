// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { registerIdentity } from '../../src/server/repositories/memberships';
import { SQLiteD1Database } from '../helpers/sqlite-d1';

function database() {
  const db = new SQLiteD1Database();
  db.applyMigrations();
  return db;
}

describe('first-login membership registration', () => {
  it('lets the fixed stable GitHub ID claim Owner even if Pending requests arrived first', async () => {
    const db = database();
    const pending = await registerIdentity(
      db,
      { id: 99, login: 'volunteer', displayName: 'Volunteer', avatarUrl: null },
      '1202831',
      new Date('2026-09-07T12:00:00Z'),
    );
    const owner = await registerIdentity(
      db,
      { id: 1_202_831, login: 'brimdor', displayName: 'Chris', avatarUrl: null },
      '1202831',
      new Date('2026-09-07T12:00:01Z'),
    );

    expect(pending).toMatchObject({ role: 'editor', status: 'pending' });
    expect(owner).toMatchObject({ role: 'owner', status: 'active' });
  });

  it('registers every later identity as a Pending Editor with no escalation on repeat login', async () => {
    const db = database();
    await registerIdentity(
      db,
      { id: 1_202_831, login: 'brimdor', displayName: 'Chris', avatarUrl: null },
      '1202831',
    );
    const first = await registerIdentity(
      db,
      { id: 2, login: 'new-editor', displayName: null, avatarUrl: null },
      '1202831',
    );
    const repeated = await registerIdentity(
      db,
      { id: 2, login: 'renamed-editor', displayName: 'New Name', avatarUrl: null },
      '1202831',
    );

    expect(first).toMatchObject({ role: 'editor', status: 'pending' });
    expect(repeated).toMatchObject({ login: 'renamed-editor', role: 'editor', status: 'pending' });
  });
});
