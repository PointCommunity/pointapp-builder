// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createServerApp } from '../../src/server/app';
import { GitHubSessionCodec, type GitHubIdentity } from '../../src/server/auth';
import { registerIdentity } from '../../src/server/repositories/memberships';
import { SQLiteD1Database } from '../helpers/sqlite-d1';

const origin = 'https://appbuilder.pointatx.org';
const secret = 'session-secret-at-least-thirty-two-characters';

async function fixture(
  identity: GitHubIdentity = {
    id: 1_202_831,
    login: 'brimdor',
    displayName: 'Chris',
    avatarUrl: null,
  },
) {
  const db = new SQLiteD1Database();
  db.applyMigrations();
  const membership = await registerIdentity(db, identity, '1202831');
  const sessions = new GitHubSessionCodec(secret);
  const token = await sessions.encodeSession(identity);
  const app = createServerApp({
    DB: db,
    ENVIRONMENT: 'test',
    APP_VERSION: 'test',
    BUILDER_ORIGIN: origin,
    AUTHENTICATION_ENABLED: 'true',
    PUBLISHING_ENABLED: 'true',
    BOOTSTRAP_OWNER_GITHUB_ID: '1202831',
    SESSION_SECRET: secret,
  });
  return { app, db, membership, cookie: `__Host-pointapp_builder_session=${token}` };
}

describe('session and membership routes', () => {
  it('returns signed-out without leaking protected data', async () => {
    const { app } = await fixture();
    const response = await app.request('/api/session');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      state: 'signed-out',
      membership: null,
      capabilities: [],
    });
  });

  it('re-reads membership on every request so disablement takes effect immediately', async () => {
    const { app, db, cookie, membership } = await fixture();
    const active = await app.request('/api/session', { headers: { cookie } });
    expect(await active.json()).toMatchObject({ state: 'active', membership: { role: 'owner' } });

    db.database
      .prepare(
        "UPDATE memberships SET status = 'disabled', version = version + 1 WHERE github_user_id = ?",
      )
      .run(membership.githubUserId);
    const disabled = await app.request('/api/session', { headers: { cookie } });
    expect(await disabled.json()).toMatchObject({ state: 'disabled', capabilities: [] });
  });

  it('denies protected access to Pending users and permits active scoped administrators', async () => {
    const pendingIdentity = { id: 2, login: 'pending', displayName: null, avatarUrl: null };
    const { app, db, cookie } = await fixture(pendingIdentity);
    const denied = await app.request('/api/memberships', { headers: { cookie } });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'MEMBERSHIP_PENDING' });

    db.database
      .prepare(
        "UPDATE memberships SET status = 'active', role = 'administrator' WHERE github_user_id = '2'",
      )
      .run();
    const allowed = await app.request('/api/memberships', { headers: { cookie } });
    expect(allowed.status).toBe(200);
  });

  it('fails the development identity route closed outside local loopback', async () => {
    const { app } = await fixture();
    const response = await app.request('/auth/dev?githubUserId=1202831&login=brimdor');
    expect(response.status).toBe(404);
  });
});
