// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createServerApp, type ApiEnvironment } from '../../src/server/app';
import { GitHubSessionCodec } from '../../src/server/auth';
import { registerIdentity } from '../../src/server/repositories/memberships';
import { SQLiteD1Database } from '../helpers/sqlite-d1';

const secret = 'operations-session-secret-at-least-thirty-two';
async function fixture(role: 'owner' | 'editor') {
  const db = new SQLiteD1Database();
  db.applyMigrations();
  const owner = await registerIdentity(
    db,
    { id: 1_202_831, login: 'brimdor', displayName: null, avatarUrl: null },
    '1202831',
  );
  const identity =
    role === 'owner'
      ? { id: 1_202_831, login: 'brimdor', displayName: null, avatarUrl: null }
      : { id: 2, login: 'editor', displayName: null, avatarUrl: null };
  if (role === 'editor') {
    await registerIdentity(db, identity, '1202831');
    db.database
      .prepare("UPDATE memberships SET status = 'active' WHERE github_user_id = '2'")
      .run();
  }
  const sessions = new GitHubSessionCodec(secret);
  const token = await sessions.encodeSession(identity);
  const environment: ApiEnvironment = {
    DB: db,
    ENVIRONMENT: 'test',
    APP_VERSION: 'test',
    BUILDER_ORIGIN: 'https://appbuilder.pointatx.org',
    AUTHENTICATION_ENABLED: 'true',
    PUBLISHING_ENABLED: 'true',
    BOOTSTRAP_OWNER_GITHUB_ID: '1202831',
    SESSION_SECRET: secret,
  };
  return {
    app: createServerApp(environment),
    cookie: `__Host-pointapp_builder_session=${token}`,
    db,
    owner,
  };
}
describe('Owner operations and audit views', () => {
  it('returns safe counts, channel state, and redacted audit rows to Owner', async () => {
    const { app, cookie } = await fixture('owner');
    const operations = await app.request('/api/operations', { headers: { cookie } });
    expect(operations.status).toBe(200);
    const body = await operations.json<Record<string, unknown>>();
    expect(JSON.stringify(body)).not.toMatch(/secret|cookie|token/i);
    const audit = await app.request('/api/audit', { headers: { cookie } });
    expect(audit.status).toBe(200);
    expect(await audit.json()).toMatchObject({ items: expect.any(Array) });
  });
  it('denies operations and audit data to Editors', async () => {
    const { app, cookie } = await fixture('editor');
    expect((await app.request('/api/operations', { headers: { cookie } })).status).toBe(403);
    expect((await app.request('/api/audit', { headers: { cookie } })).status).toBe(403);
  });
  it('records denied mutations with correlation and paginates without sensitive payloads', async () => {
    const { app, cookie } = await fixture('owner');
    const denied = await app.request('/api/drafts', {
      method: 'POST',
      headers: {
        cookie,
        origin: 'https://attacker.example',
        'sec-fetch-site': 'cross-site',
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify({ name: 'Never stored', token: 'not-a-real-secret' }),
    });
    expect(denied.status).toBe(403);
    const audit = await app.request('/api/audit?limit=1', { headers: { cookie } });
    const page = await audit.json<{
      items: Array<Record<string, unknown>>;
      nextCursor: string | null;
    }>();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      action: 'draft.request',
      outcome: 'denied',
      reason: 'ORIGIN_DENIED',
      requestId: expect.any(String),
    });
    expect(JSON.stringify(page)).not.toContain('not-a-real-secret');
  });
});
