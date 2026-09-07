// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { listMemberships, registerIdentity } from '../../src/server/repositories/memberships';
import { updateMembership } from '../../src/server/services/memberships';
import { ProblemError } from '../../src/server/problems';
import { SQLiteD1Database } from '../helpers/sqlite-d1';

async function fixture() {
  const db = new SQLiteD1Database();
  db.applyMigrations();
  const owner = await registerIdentity(
    db,
    { id: 1_202_831, login: 'brimdor', displayName: 'Chris', avatarUrl: null },
    '1202831',
  );
  const editor = await registerIdentity(
    db,
    { id: 2, login: 'editor', displayName: 'Editor', avatarUrl: null },
    '1202831',
  );
  return { db, owner, editor };
}

describe('membership governance', () => {
  it('lets Owner approve a Pending Editor and assign any role with audit evidence', async () => {
    const { db, owner, editor } = await fixture();
    const updated = await updateMembership(db, {
      actor: owner,
      targetGithubUserId: editor.githubUserId,
      expectedVersion: editor.version,
      role: 'publisher',
      status: 'active',
      reason: 'Approved for publishing',
      requestId: '0c5df84c-d37d-4e16-8669-a566513ee42f',
    });

    expect(updated).toMatchObject({ role: 'publisher', status: 'active', version: 2 });
    expect(
      db.database
        .prepare("SELECT outcome FROM audit_events WHERE action = 'membership.update'")
        .get(),
    ).toEqual({ outcome: 'succeeded' });
  });

  it('lets Administrator manage Editors and Publishers but not Administrators or Owners', async () => {
    const { db, owner, editor } = await fixture();
    const administrator = await updateMembership(db, {
      actor: owner,
      targetGithubUserId: editor.githubUserId,
      expectedVersion: editor.version,
      role: 'administrator',
      status: 'active',
      reason: 'Operations lead',
      requestId: crypto.randomUUID(),
    });
    const volunteer = await registerIdentity(
      db,
      { id: 3, login: 'volunteer', displayName: null, avatarUrl: null },
      '1202831',
    );

    await expect(
      updateMembership(db, {
        actor: administrator,
        targetGithubUserId: volunteer.githubUserId,
        expectedVersion: volunteer.version,
        role: 'editor',
        status: 'active',
        reason: 'Content team',
        requestId: crypto.randomUUID(),
      }),
    ).resolves.toMatchObject({ status: 'active' });
    await expect(
      updateMembership(db, {
        actor: administrator,
        targetGithubUserId: owner.githubUserId,
        expectedVersion: owner.version,
        role: 'editor',
        status: 'active',
        reason: 'Not allowed',
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<ProblemError>>({ status: 403 }));
  });

  it('rejects stale updates and never demotes or disables the final Active Owner', async () => {
    const { db, owner } = await fixture();
    const attempt = (
      expectedVersion: number,
      role: 'editor' | 'owner',
      status: 'active' | 'disabled',
    ) =>
      updateMembership(db, {
        actor: owner,
        targetGithubUserId: owner.githubUserId,
        expectedVersion,
        role,
        status,
        reason: 'Governance test',
        requestId: crypto.randomUUID(),
      });

    await expect(attempt(owner.version - 1, 'owner', 'active')).rejects.toMatchObject({
      status: 409,
      code: 'MEMBERSHIP_CONFLICT',
    });
    await expect(attempt(owner.version, 'editor', 'active')).rejects.toMatchObject({
      status: 409,
      code: 'LAST_OWNER_REQUIRED',
    });
    await expect(attempt(owner.version, 'owner', 'disabled')).rejects.toMatchObject({
      status: 409,
      code: 'LAST_OWNER_REQUIRED',
    });
  });

  it('scopes Administrator listings away from higher-authority records', async () => {
    const { db, owner, editor } = await fixture();
    const administrator = await updateMembership(db, {
      actor: owner,
      targetGithubUserId: editor.githubUserId,
      expectedVersion: editor.version,
      role: 'administrator',
      status: 'active',
      reason: 'Operations lead',
      requestId: crypto.randomUUID(),
    });
    await registerIdentity(
      db,
      { id: 3, login: 'volunteer', displayName: null, avatarUrl: null },
      '1202831',
    );

    const visible = await listMemberships(db, administrator, 25);
    expect(visible.items.map((item) => item.login)).toEqual(['volunteer']);
  });
});
