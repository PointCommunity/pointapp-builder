import { describe, expect, it } from 'vitest';
import {
  POINTAPP_CLOUDFLARE_ACCOUNT_ID,
  POINTAPP_CLOUDFLARE_EMAIL,
  validatePointAppCloudflareIdentity,
} from '../../scripts/verify-cloudflare-account';

describe('PointApp Cloudflare account guard', () => {
  it('accepts only the expected signed-in account', () => {
    expect(
      validatePointAppCloudflareIdentity({
        loggedIn: true,
        email: POINTAPP_CLOUDFLARE_EMAIL,
        accounts: [{ id: POINTAPP_CLOUDFLARE_ACCOUNT_ID, name: 'Point Community Church' }],
      }),
    ).toEqual({
      accountId: POINTAPP_CLOUDFLARE_ACCOUNT_ID,
      email: POINTAPP_CLOUDFLARE_EMAIL,
    });
  });

  it.each([
    null,
    {},
    { loggedIn: false, email: POINTAPP_CLOUDFLARE_EMAIL, accounts: [] },
    { loggedIn: true, email: 'someone@example.com', accounts: [] },
    { loggedIn: true, email: POINTAPP_CLOUDFLARE_EMAIL, accounts: [{ id: 'wrong-account' }] },
  ])('rejects an unexpected identity: %j', (identity) => {
    expect(() => validatePointAppCloudflareIdentity(identity)).toThrow(/refusing/i);
  });
});
