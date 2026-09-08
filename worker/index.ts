import { createServerApp, type ApiEnvironment } from '../src/server/app';
import { applySecurityHeaders } from '../src/server/security';
import { productionConfigurationIssues } from '../src/server/configuration';

interface AssetBinding {
  fetch(request: Request): Promise<Response>;
}

export interface RuntimeEnv extends ApiEnvironment {
  ASSETS: AssetBinding;
  BUILDER_ORIGIN: string;
  BOOTSTRAP_OWNER_GITHUB_ID: string;
  REGISTRATION_POLICY?: string;
  SIGNING_KEY_ID?: string;
  AUTH_RATE_LIMITER?: RateLimit;
  MUTATION_RATE_LIMITER?: RateLimit;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  RELEASE_SIGNING_PRIVATE_JWK?: string;
  RELEASE_SIGNING_PUBLIC_JWK?: string;
}

function isServerRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/content/')
  );
}

export async function handleRequest(request: Request, env: RuntimeEnv): Promise<Response> {
  const configurationIssues = productionConfigurationIssues(env);
  if (configurationIssues.length > 0)
    return applySecurityHeaders(
      Response.json(
        {
          type: 'https://appbuilder.pointatx.org/problems/configuration-unavailable',
          title: 'Service configuration unavailable',
          status: 503,
          code: 'CONFIGURATION_UNAVAILABLE',
          detail: 'PointApp Builder is not ready to serve requests.',
          requestId: crypto.randomUUID(),
        },
        { status: 503 },
      ),
    );
  const url = new URL(request.url);
  const builderUrl = new URL(env.BUILDER_ORIGIN);
  if (
    builderUrl.protocol === 'https:' &&
    url.protocol === 'http:' &&
    url.hostname === builderUrl.hostname
  ) {
    url.protocol = 'https:';
    return Response.redirect(url, 308);
  }

  if (isServerRoute(url.pathname)) return createServerApp(env).fetch(request);

  const asset = await env.ASSETS.fetch(request);
  return applySecurityHeaders(asset, {
    cacheControl: asset.headers.get('cache-control') ?? 'public, max-age=0, must-revalidate',
    contentSecurityPolicy:
      "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  });
}

export default { fetch: handleRequest };
