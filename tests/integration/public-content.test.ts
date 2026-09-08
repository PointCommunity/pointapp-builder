// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createServerApp, type ApiEnvironment } from '../../src/server/app';
import { registerIdentity } from '../../src/server/repositories/memberships';
import { createDraft } from '../../src/server/services/drafts';
import {
  generatedSigner,
  promoteProduction,
  publishStaging,
} from '../../src/server/services/releases';
import { SQLiteD1Database } from '../helpers/sqlite-d1';

async function fixture() {
  const db = new SQLiteD1Database();
  db.applyMigrations();
  const actor = await registerIdentity(
    db,
    { id: 1_202_831, login: 'brimdor', displayName: null, avatarUrl: null },
    '1202831',
  );
  const draft = await createDraft(db, { name: 'Public', actor, requestId: crypto.randomUUID() });
  const signer = await generatedSigner('public-test-key');
  const staging = await publishStaging(db, {
    revisionId: draft.currentRevision.id,
    actor,
    requestId: crypto.randomUUID(),
    signer,
  });
  await promoteProduction(db, {
    stagingReleaseId: staging.releaseId,
    actor,
    requestId: crypto.randomUUID(),
  });
  const environment: ApiEnvironment = {
    DB: db,
    ENVIRONMENT: 'test',
    APP_VERSION: 'test',
    BUILDER_ORIGIN: 'https://appbuilder.pointatx.org',
    AUTHENTICATION_ENABLED: 'true',
    PUBLISHING_ENABLED: 'true',
    BOOTSTRAP_OWNER_GITHUB_ID: '1202831',
  };
  return {
    app: createServerApp(environment, { sessions: undefined, authenticator: undefined }),
    signer,
  };
}
describe('anonymous installed-app contract', () => {
  it('serves a signed envelope with ETag and then 304', async () => {
    const { app } = await fixture();
    const first = await app.request('/content/v1/channels/production');
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toContain('must-revalidate');
    const etag = first.headers.get('etag')!;
    const second = await app.request('/content/v1/channels/production', {
      headers: { 'if-none-match': etag },
    });
    expect(second.status).toBe(304);
    expect(second.headers.get('etag')).toBe(etag);
  });
  it('serves the public verification key without exposing private state', async () => {
    const { app, signer } = await fixture();
    const response = await app.request(`/content/v1/keys/${signer.keyId}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/jwk+json');
    const key = await response.json<Record<string, unknown>>();
    expect(key.d).toBeUndefined();
    expect(key.x).toBeTruthy();
  });
  it('does not expose arbitrary private media', async () => {
    const { app } = await fixture();
    expect((await app.request(`/content/v1/media/${crypto.randomUUID()}`)).status).toBe(404);
  });
});
