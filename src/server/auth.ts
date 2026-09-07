import { z } from 'zod';
import { ProblemError } from './problems';

const SESSION_COOKIE = '__Host-pointapp_builder_session';
const OAUTH_COOKIE = '__Host-pointapp_builder_oauth';
const SESSION_SECONDS = 8 * 60 * 60;
const OAUTH_SECONDS = 10 * 60;
const encoder = new TextEncoder();

export interface GitHubIdentity {
  id: number;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface GitHubAuthConfig {
  builderOrigin: string;
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
}

export interface GitHubIdentityGateway {
  authorizationUrl(input: { state: string; codeChallenge: string; redirectUri: string }): URL;
  exchangeCode(code: string, codeVerifier: string): Promise<GitHubIdentity>;
}

const GitHubIdentitySchema = z.object({
  id: z.number().int().positive(),
  login: z.string().regex(/^[A-Za-z0-9-]{1,39}$/),
  name: z.string().max(120).nullable().optional(),
  avatar_url: z.url().nullable().optional(),
});
const SessionSchema = z.strictObject({
  kind: z.literal('session'),
  id: z.number().int().positive(),
  login: z.string().regex(/^[A-Za-z0-9-]{1,39}$/),
  displayName: z.string().max(120).nullable(),
  avatarUrl: z.url().nullable(),
  exp: z.number().int().positive(),
});
const OAuthStateSchema = z.strictObject({
  kind: z.literal('oauth'),
  state: z.string().min(32).max(100),
  verifier: z.string().min(43).max(128),
  returnTo: z
    .string()
    .regex(/^\/[A-Za-z0-9/_?=&.-]*$/)
    .max(256),
  exp: z.number().int().positive(),
});
const TokenSchema = z.object({ access_token: z.string().min(20) });

export class AuthenticationError extends ProblemError {
  constructor(message = 'Sign in with GitHub to continue') {
    super(401, 'UNAUTHENTICATED', message);
    this.name = 'AuthenticationError';
  }
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

class SignedTokenCodec {
  constructor(private readonly secret: string) {
    if (secret.length < 32) throw new Error('Session secret must contain at least 32 characters');
  }

  async encode(payload: unknown): Promise<string> {
    const body = base64url(encoder.encode(JSON.stringify(payload)));
    const signature = await crypto.subtle.sign(
      'HMAC',
      await hmacKey(this.secret),
      encoder.encode(body),
    );
    return `${body}.${base64url(new Uint8Array(signature))}`;
  }

  async decode(token: string): Promise<unknown> {
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra) throw new AuthenticationError();
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(this.secret),
      Uint8Array.from(decodeBase64url(signature)).buffer,
      encoder.encode(body),
    );
    if (!valid) throw new AuthenticationError();
    try {
      return JSON.parse(new TextDecoder().decode(decodeBase64url(body))) as unknown;
    } catch {
      throw new AuthenticationError();
    }
  }
}

function readCookie(request: Request, name: string): string | null {
  for (const item of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function setCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function assertRequestOrigin(request: Request, expectedOrigin: string): void {
  if (new URL(request.url).origin !== expectedOrigin) {
    throw new AuthenticationError('Invalid login origin');
  }
}

function safeReturnTo(value: string | null): string {
  return /^\/[A-Za-z0-9/_?=&.-]*$/.test(value ?? '') ? (value as string) : '/';
}

export class GitHubSessionCodec {
  readonly #codec: SignedTokenCodec;

  constructor(secret: string) {
    this.#codec = new SignedTokenCodec(secret);
  }

  encodeSession(identity: GitHubIdentity, now = new Date(), lifetime = SESSION_SECONDS) {
    return this.#codec.encode({
      kind: 'session',
      ...identity,
      exp: Math.floor(now.getTime() / 1000) + lifetime,
    });
  }

  async identityFromRequest(request: Request, now = new Date()): Promise<GitHubIdentity> {
    const token = readCookie(request, SESSION_COOKIE);
    if (!token) throw new AuthenticationError();
    let session: z.infer<typeof SessionSchema>;
    try {
      session = SessionSchema.parse(await this.#codec.decode(token));
    } catch {
      throw new AuthenticationError();
    }
    if (session.exp <= Math.floor(now.getTime() / 1000)) throw new AuthenticationError();
    return {
      id: session.id,
      login: session.login,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
    };
  }

  encodeOAuth(state: string, verifier: string, returnTo: string, now = new Date()) {
    return this.#codec.encode({
      kind: 'oauth',
      state,
      verifier,
      returnTo,
      exp: Math.floor(now.getTime() / 1000) + OAUTH_SECONDS,
    });
  }

  async decodeOAuth(token: string, now = new Date()) {
    let state: z.infer<typeof OAuthStateSchema>;
    try {
      state = OAuthStateSchema.parse(await this.#codec.decode(token));
    } catch {
      throw new AuthenticationError('GitHub sign-in state is invalid');
    }
    if (state.exp <= Math.floor(now.getTime() / 1000)) {
      throw new AuthenticationError('GitHub sign-in expired; start again');
    }
    return state;
  }

  clearSessionCookie(): string {
    return setCookie(SESSION_COOKIE, '', 0);
  }

  async sessionResponse(
    identity: GitHubIdentity,
    location: string,
    now = new Date(),
  ): Promise<Response> {
    return new Response(null, {
      status: 302,
      headers: {
        location,
        'set-cookie': setCookie(
          SESSION_COOKIE,
          await this.encodeSession(identity, now),
          SESSION_SECONDS,
        ),
      },
    });
  }
}

export class GitHubAuthenticator {
  constructor(
    private readonly config: GitHubAuthConfig,
    private readonly gateway: GitHubIdentityGateway,
    private readonly sessions: GitHubSessionCodec,
  ) {}

  async beginLogin(request: Request): Promise<Response> {
    assertRequestOrigin(request, this.config.builderOrigin);
    const state = randomToken();
    const verifier = randomToken();
    const challenge = base64url(
      new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))),
    );
    const returnTo = safeReturnTo(new URL(request.url).searchParams.get('returnTo'));
    const location = this.gateway.authorizationUrl({
      state,
      codeChallenge: challenge,
      redirectUri: `${this.config.builderOrigin}/auth/callback`,
    });
    return new Response(null, {
      status: 302,
      headers: {
        location: location.toString(),
        'set-cookie': setCookie(
          OAUTH_COOKIE,
          await this.sessions.encodeOAuth(state, verifier, returnTo),
          OAUTH_SECONDS,
        ),
      },
    });
  }

  async completeLogin(
    request: Request,
    now = new Date(),
  ): Promise<{ identity: GitHubIdentity; response: Response }> {
    assertRequestOrigin(request, this.config.builderOrigin);
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const stateCookie = readCookie(request, OAUTH_COOKIE);
    if (!code || !state || !stateCookie) {
      throw new AuthenticationError('GitHub sign-in state is missing');
    }
    const saved = await this.sessions.decodeOAuth(stateCookie, now);
    if (saved.state !== state) throw new AuthenticationError('GitHub sign-in state does not match');
    const identity = await this.gateway.exchangeCode(code, saved.verifier);
    const response = await this.sessions.sessionResponse(
      identity,
      `${this.config.builderOrigin}${saved.returnTo}`,
      now,
    );
    response.headers.append('set-cookie', setCookie(OAUTH_COOKIE, '', 0));
    return { identity, response };
  }

  logout(): Response {
    return new Response(null, {
      status: 204,
      headers: { 'set-cookie': this.sessions.clearSessionCookie() },
    });
  }
}

export class GitHubApiGateway implements GitHubIdentityGateway {
  constructor(
    private readonly config: Pick<GitHubAuthConfig, 'builderOrigin' | 'clientId' | 'clientSecret'>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  authorizationUrl(input: { state: string; codeChallenge: string; redirectUri: string }): URL {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url;
  }

  async exchangeCode(code: string, codeVerifier: string): Promise<GitHubIdentity> {
    const tokenResponse = await this.fetcher('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: `${this.config.builderOrigin}/auth/callback`,
      }),
    });
    if (!tokenResponse.ok) throw new AuthenticationError('GitHub sign-in exchange failed');
    const token = TokenSchema.parse(await tokenResponse.json()).access_token;
    const userResponse = await this.fetcher('https://api.github.com/user', {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'user-agent': 'PointApp-Builder',
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!userResponse.ok) throw new AuthenticationError('GitHub identity could not be verified');
    const user = GitHubIdentitySchema.parse(await userResponse.json());
    return {
      id: user.id,
      login: user.login,
      displayName: user.name ?? null,
      avatarUrl: user.avatar_url ?? null,
    };
  }
}
