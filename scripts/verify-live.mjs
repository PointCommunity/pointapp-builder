import { createHash, createPublicKey, verify } from 'node:crypto';

const origin = process.env.POINTAPP_BUILDER_ORIGIN ?? 'https://appbuilder.pointatx.org';
const expectedVersion = process.env.POINTAPP_BUILDER_VERSION ?? '0.1.0';
const httpOrigin = origin.replace(/^https:/, 'http:');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function fetchChecked(path, expectedStatus = 200, init = {}) {
  const url = new URL(path, origin);
  const response = await fetch(url, init);
  assert(response.status === expectedStatus, `${url} returned ${response.status}`);
  return response;
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
}
function base64url(value) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

const healthResponse = await fetchChecked('/api/health');
const health = await healthResponse.json();
assert(health.status === 'ok', 'Health response is degraded.');
assert(health.service === 'pointapp-builder', 'Unexpected health service.');
assert(health.environment === 'production', 'Health response is not production.');
assert(health.version === expectedVersion, 'Unexpected deployed application version.');
assert(health.checks?.database === 'ok', 'D1 binding is unavailable.');
assert(health.checks?.authentication === 'ok', 'Authentication is unavailable.');
assert(health.checks?.publishing === 'ok', 'Publishing is unavailable.');
for (const header of [
  'content-security-policy',
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
])
  assert(healthResponse.headers.has(header), `Health is missing ${header}.`);
assert(healthResponse.headers.get('cache-control') === 'no-store', 'Health must not be cached.');

const redirectResponse = await fetch(new URL('/release-check?device=phone', httpOrigin), {
  redirect: 'manual',
});
assert(redirectResponse.status === 308, `HTTP returned ${redirectResponse.status} instead of 308.`);
assert(
  redirectResponse.headers.get('location') === `${origin}/release-check?device=phone`,
  'HTTP did not redirect to the same HTTPS path.',
);

for (const path of ['/api/drafts', '/api/memberships', '/api/operations']) {
  const response = await fetchChecked(path, 401);
  const body = await response.json();
  assert(body.code === 'UNAUTHENTICATED', `${path} did not deny anonymous access.`);
}
const login = await fetchChecked('/auth/login', 302, { redirect: 'manual' });
assert(
  login.headers.get('location')?.startsWith('https://github.com/login/oauth/authorize'),
  'Login did not begin GitHub authorization.',
);

const documentResponse = await fetchChecked('/');
const html = await documentResponse.text();
assert(html.includes('<title>PointApp Builder</title>'), 'Root document is not PointApp Builder.');
const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)]
  .map((match) => match[1])
  .filter((path) => path.startsWith('/assets/'));
assert(assetPaths.length > 0, 'No compiled JavaScript or CSS assets were found.');
const assetDigests = [];
for (const assetPath of new Set(assetPaths)) {
  const response = await fetchChecked(assetPath);
  const type = response.headers.get('content-type') ?? '';
  assert(
    type.includes('javascript') || type.includes('css'),
    `${assetPath} returned an unexpected content type: ${type}`,
  );
  assetDigests.push(
    createHash('sha256')
      .update(Buffer.from(await response.arrayBuffer()))
      .digest('hex'),
  );
}

const production = await fetchChecked('/content/v1/channels/production');
const etag = production.headers.get('etag');
assert(/^"sha256-[a-f0-9]{64}"$/.test(etag ?? ''), 'Production ETag is invalid.');
const envelope = await production.json();
assert(envelope.manifestDigest === etag.slice(8, -1), 'ETag does not match manifest digest.');
const cached = await fetchChecked('/content/v1/channels/production', 304, {
  headers: { 'if-none-match': etag },
});
assert(cached.headers.get('etag') === etag, '304 response lost the current ETag.');
const keyResponse = await fetchChecked(
  `/content/v1/keys/${encodeURIComponent(envelope.signing.keyId)}`,
);
assert(
  keyResponse.headers.get('content-type')?.includes('application/jwk+json'),
  'Public key type is invalid.',
);
const publicJwk = await keyResponse.json();
const { signing, ...unsigned } = envelope;
assert(
  verify(
    null,
    Buffer.from(canonical(unsigned)),
    createPublicKey({ key: publicJwk, format: 'jwk' }),
    base64url(signing.signature),
  ),
  'Production release signature did not verify.',
);

process.stdout.write(
  `Verified ${origin}: production health, GitHub login, anonymous isolation, ${assetDigests.length} assets, signed PointApp Production, and ETag revalidation.\n`,
);
