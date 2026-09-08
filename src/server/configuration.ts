import type { ApiEnvironment } from './app';

export function productionConfigurationIssues(environment: ApiEnvironment): string[] {
  if (environment.ENVIRONMENT !== 'production') return [];
  const issues: string[] = [];
  if (environment.AUTHENTICATION_ENABLED !== 'true') issues.push('AUTHENTICATION_ENABLED');
  if (environment.PUBLISHING_ENABLED !== 'true') issues.push('PUBLISHING_ENABLED');
  if (!environment.GITHUB_CLIENT_ID) issues.push('GITHUB_CLIENT_ID');
  if (!environment.GITHUB_CLIENT_SECRET) issues.push('GITHUB_CLIENT_SECRET');
  if (!environment.SESSION_SECRET || environment.SESSION_SECRET.length < 32)
    issues.push('SESSION_SECRET');
  if (!environment.SIGNING_KEY_ID) issues.push('SIGNING_KEY_ID');
  if (!/^[1-9][0-9]{0,19}$/.test(environment.BOOTSTRAP_OWNER_GITHUB_ID))
    issues.push('BOOTSTRAP_OWNER_GITHUB_ID');
  try {
    const origin = new URL(environment.BUILDER_ORIGIN);
    if (origin.protocol !== 'https:' || origin.origin !== environment.BUILDER_ORIGIN)
      issues.push('BUILDER_ORIGIN');
  } catch {
    issues.push('BUILDER_ORIGIN');
  }
  try {
    const privateJwk = JSON.parse(environment.RELEASE_SIGNING_PRIVATE_JWK ?? '') as JsonWebKey;
    if (privateJwk.kty !== 'OKP' || privateJwk.crv !== 'Ed25519' || !privateJwk.d)
      issues.push('RELEASE_SIGNING_PRIVATE_JWK');
  } catch {
    issues.push('RELEASE_SIGNING_PRIVATE_JWK');
  }
  try {
    const publicJwk = JSON.parse(environment.RELEASE_SIGNING_PUBLIC_JWK ?? '') as JsonWebKey;
    const privateJwk = JSON.parse(environment.RELEASE_SIGNING_PRIVATE_JWK ?? '') as JsonWebKey;
    if (
      publicJwk.kty !== 'OKP' ||
      publicJwk.crv !== 'Ed25519' ||
      !publicJwk.x ||
      publicJwk.d ||
      publicJwk.x !== privateJwk.x
    )
      issues.push('RELEASE_SIGNING_PUBLIC_JWK');
  } catch {
    issues.push('RELEASE_SIGNING_PUBLIC_JWK');
  }
  return [...new Set(issues)];
}
