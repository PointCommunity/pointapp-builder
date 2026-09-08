// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  GitHubApiGateway,
  GitHubAuthenticator,
  GitHubSessionCodec,
  type GitHubIdentity,
  type GitHubIdentityGateway,
} from '../../../src/server/auth';

const config = {
  builderOrigin: 'https://appbuilder.pointatx.org',
  clientId: 'Iv23liGRM9o6nRNwBSs3',
  clientSecret: 'github-client-secret-placeholder',
  sessionSecret: 'session-secret-at-least-thirty-two-characters',
};
const identity: GitHubIdentity = {
  id: 1_202_831,
  login: 'brimdor',
  displayName: 'Chris',
  avatarUrl: 'https://avatars.githubusercontent.com/u/1202831',
};

function gateway(): GitHubIdentityGateway {
  return {
    authorizationUrl: ({ state, codeChallenge, redirectUri }) => {
      expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(redirectUri).toBe(`${config.builderOrigin}/auth/callback`);
      return new URL(`https://github.com/login/oauth/authorize?state=${state}`);
    },
    exchangeCode: (code, verifier) => {
      expect(code).toBe('temporary-code');
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      return Promise.resolve(identity);
    },
  };
}

describe('GitHub App OAuth', () => {
  it('exchanges the code with PKCE and revalidates the GitHub identity', async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetcher = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      expect(this).toBeUndefined();
      requests.push({ input, init });
      if (requests.length === 1) {
        return Response.json({ access_token: 'ghu_valid-user-access-token' });
      }
      return Response.json({
        id: identity.id,
        login: identity.login,
        name: identity.displayName,
        avatar_url: identity.avatarUrl,
      });
    };
    const api = new GitHubApiGateway(config, fetcher as typeof fetch);

    await expect(api.exchangeCode('temporary-code', 'pkce-verifier')).resolves.toEqual(identity);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.input).toBe('https://github.com/login/oauth/access_token');
    expect(requests[0]?.init?.headers).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: 'temporary-code',
      code_verifier: 'pkce-verifier',
      redirect_uri: `${config.builderOrigin}/auth/callback`,
    });
    expect(requests[1]?.input).toBe('https://api.github.com/user');
    expect(requests[1]?.init?.headers).toMatchObject({
      authorization: 'Bearer ghu_valid-user-access-token',
    });
  });

  it('turns an HTTP 200 OAuth error payload into a safe diagnostic problem', async () => {
    const api = new GitHubApiGateway(config, (() =>
      Promise.resolve(Response.json({ error: 'incorrect_client_credentials' }))) as typeof fetch);

    await expect(api.exchangeCode('temporary-code', 'pkce-verifier')).rejects.toMatchObject({
      status: 401,
      code: 'GITHUB_OAUTH_CLIENT_CREDENTIALS_REJECTED',
      message: 'GitHub rejected the Builder OAuth client credentials',
    });
  });

  it.each([
    ['redirect_uri_mismatch', 'GITHUB_OAUTH_CALLBACK_REJECTED'],
    ['bad_verification_code', 'GITHUB_OAUTH_CODE_REJECTED'],
    ['unverified_user_email', 'GITHUB_OAUTH_EMAIL_UNVERIFIED'],
    ['unexpected_upstream_error', 'GITHUB_OAUTH_EXCHANGE_REJECTED'],
  ])('classifies the safe GitHub OAuth error %s', async (error, expectedCode) => {
    const api = new GitHubApiGateway(config, (() =>
      Promise.resolve(Response.json({ error }))) as typeof fetch);

    await expect(api.exchangeCode('temporary-code', 'pkce-verifier')).rejects.toMatchObject({
      status: 401,
      code: expectedCode,
    });
  });

  it('rejects a malformed GitHub identity without exposing the upstream payload', async () => {
    const responses = [
      Response.json({ access_token: 'ghu_valid-user-access-token' }),
      Response.json({ id: 'not-a-number', login: 'brimdor' }),
    ];
    const api = new GitHubApiGateway(config, (() =>
      Promise.resolve(responses.shift() ?? Response.error())) as typeof fetch);

    await expect(api.exchangeCode('temporary-code', 'pkce-verifier')).rejects.toMatchObject({
      status: 401,
      code: 'GITHUB_IDENTITY_INVALID',
      message: 'GitHub returned an invalid identity',
    });
  });

  it('uses state and PKCE then issues a unique host-only secure session', async () => {
    const codec = new GitHubSessionCodec(config.sessionSecret);
    const authenticator = new GitHubAuthenticator(config, gateway(), codec);
    const login = await authenticator.beginLogin(
      new Request(`${config.builderOrigin}/auth/login?returnTo=%2Fcontent`),
    );
    const location = new URL(login.headers.get('location') ?? '');
    const state = location.searchParams.get('state');
    const oauthCookie = login.headers.get('set-cookie') ?? '';

    expect(location.origin).toBe('https://github.com');
    expect(oauthCookie).toContain('__Host-pointapp_builder_oauth=');
    expect(oauthCookie).toContain('HttpOnly');
    expect(oauthCookie).toContain('Secure');
    expect(oauthCookie).toContain('SameSite=Lax');
    expect(oauthCookie).not.toContain('Domain=');

    const completed = await authenticator.completeLogin(
      new Request(
        `${config.builderOrigin}/auth/callback?code=temporary-code&state=${encodeURIComponent(state ?? '')}`,
        { headers: { cookie: oauthCookie.split(';')[0] ?? '' } },
      ),
    );
    expect(completed.identity).toEqual(identity);
    expect(completed.response.status).toBe(302);
    expect(completed.response.headers.get('location')).toBe(`${config.builderOrigin}/content`);
    expect(completed.response.headers.get('set-cookie')).toContain(
      '__Host-pointapp_builder_session=',
    );
    expect(completed.response.headers.get('set-cookie')).not.toContain('Domain=');
  });

  it('rejects missing forged and expired sessions', async () => {
    const codec = new GitHubSessionCodec(config.sessionSecret);
    const request = (value?: string) =>
      new Request(`${config.builderOrigin}/api/session`, {
        headers: value ? { cookie: `__Host-pointapp_builder_session=${value}` } : {},
      });

    await expect(codec.identityFromRequest(request())).rejects.toBeInstanceOf(AuthenticationError);
    await expect(codec.identityFromRequest(request('forged.value'))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    const expired = await codec.encodeSession(identity, new Date('2026-09-07T00:00:00Z'), -1);
    await expect(
      codec.identityFromRequest(request(expired), new Date('2026-09-07T00:00:01Z')),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('uses an unprefixed non-secure cookie only for loopback development', async () => {
    const codec = new GitHubSessionCodec(config.sessionSecret);
    const response = await codec.sessionResponse(identity, 'http://127.0.0.1:4173/');
    const cookie = response.headers.get('set-cookie') ?? '';
    const token = cookie.split(';')[0]?.split('=').slice(1).join('=') ?? '';

    expect(cookie).toContain('pointapp_builder_session=');
    expect(cookie).not.toContain('__Host-');
    expect(cookie).not.toContain('Secure');
    await expect(
      codec.identityFromRequest(
        new Request('http://127.0.0.1:4173/api/session', {
          headers: { cookie: `pointapp_builder_session=${token}` },
        }),
      ),
    ).resolves.toEqual(identity);
  });

  it('rejects a mismatched or expired OAuth state before exchange', async () => {
    const codec = new GitHubSessionCodec(config.sessionSecret);
    const authenticator = new GitHubAuthenticator(config, gateway(), codec);
    const login = await authenticator.beginLogin(new Request(`${config.builderOrigin}/auth/login`));
    const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';

    await expect(
      authenticator.completeLogin(
        new Request(`${config.builderOrigin}/auth/callback?code=temporary-code&state=wrong`, {
          headers: { cookie },
        }),
      ),
    ).rejects.toThrow(/state/i);
  });
});
