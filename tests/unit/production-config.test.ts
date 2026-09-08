// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { missingProductionSecrets } from '../../scripts/verify-production-config';

describe('production secret preflight', () => {
  it('checks binding names without requiring or exposing values', () => {
    expect(
      missingProductionSecrets([
        { name: 'GITHUB_CLIENT_ID' },
        { name: 'GITHUB_CLIENT_SECRET' },
        { name: 'SESSION_SECRET' },
        { name: 'RELEASE_SIGNING_PRIVATE_JWK' },
        { name: 'RELEASE_SIGNING_PUBLIC_JWK' },
      ]),
    ).toEqual([]);
    expect(missingProductionSecrets([{ name: 'SESSION_SECRET' }])).toContain(
      'GITHUB_CLIENT_SECRET',
    );
  });
});
