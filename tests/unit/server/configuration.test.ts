// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { productionConfigurationIssues } from '../../../src/server/configuration';

const ready = {
  DB: {} as D1Database,
  ENVIRONMENT: 'production',
  APP_VERSION: 'test',
  BUILDER_ORIGIN: 'https://appbuilder.pointatx.org',
  AUTHENTICATION_ENABLED: 'true',
  PUBLISHING_ENABLED: 'true',
  BOOTSTRAP_OWNER_GITHUB_ID: '1202831',
  GITHUB_CLIENT_ID: 'Iv1.fixture',
  GITHUB_CLIENT_SECRET: 'secret',
  SESSION_SECRET: 'a'.repeat(32),
  SIGNING_KEY_ID: 'pointapp-2026-01',
  RELEASE_SIGNING_PRIVATE_JWK: JSON.stringify({
    kty: 'OKP',
    crv: 'Ed25519',
    x: 'public',
    d: 'private',
  }),
  RELEASE_SIGNING_PUBLIC_JWK: JSON.stringify({ kty: 'OKP', crv: 'Ed25519', x: 'public' }),
};

describe('production configuration', () => {
  it('accepts the complete fail-closed production configuration', () => {
    expect(productionConfigurationIssues(ready)).toEqual([]);
  });

  it('reports names only and ignores incomplete local fixtures', () => {
    expect(
      productionConfigurationIssues({
        ...ready,
        SESSION_SECRET: '',
        RELEASE_SIGNING_PRIVATE_JWK: '{}',
      }),
    ).toEqual(['SESSION_SECRET', 'RELEASE_SIGNING_PRIVATE_JWK', 'RELEASE_SIGNING_PUBLIC_JWK']);
    expect(
      productionConfigurationIssues({ ...ready, ENVIRONMENT: 'local', SESSION_SECRET: '' }),
    ).toEqual([]);
  });
});
