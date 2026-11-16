#!/usr/bin/env node

import { createHash, createPublicKey, verify } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const DEFAULT_PRODUCTION_URL = 'https://appbuilder.pointatx.org';
const PRODUCTION_URL = process.env.POINTAPP_BUILDER_ORIGIN ?? DEFAULT_PRODUCTION_URL;
const EXPECTED_VERSION = process.env.POINTAPP_BUILDER_VERSION ?? '0.1.0';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateHealthPayload(value, expectedVersion = EXPECTED_VERSION) {
  if (!value || typeof value !== 'object') {
    throw new Error('Builder health returned a non-object payload.');
  }
  if (value.status !== 'ok' || value.service !== 'pointapp-builder') {
    throw new Error('Builder health must report the pointapp-builder service as ok.');
  }
  if (value.environment !== 'production') {
    throw new Error('Builder health must report the production environment.');
  }
  if (value.version !== expectedVersion) {
    throw new Error(
      `Builder health reported version ${value.version || '(missing)'}, expected ${expectedVersion}.`,
    );
  }
  for (const check of ['database', 'authentication', 'publishing']) {
    if (value.checks?.[check] !== 'ok') {
      throw new Error(`Builder health check ${check} is not ok.`);
    }
  }
  return { service: value.service, environment: value.environment, version: value.version };
}

export function validateHtml(html) {
  if (!/^\s*<!doctype html>/i.test(html)) {
    throw new Error('Builder root did not return an HTML document.');
  }
  if (!/<title>PointApp Builder<\/title>/i.test(html)) {
    throw new Error('Builder HTML is missing the PointApp Builder title.');
  }
  if (!/<div\s+id=["']root["']/i.test(html)) {
    throw new Error('Builder HTML is missing the application root.');
  }
}

export function extractAssetPaths(html, baseUrl = PRODUCTION_URL) {
  const paths = [];
  const seen = new Set();
  const attributePattern = /(?:src|href)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(attributePattern)) {
    let url;
    try {
      url = new URL(match[1], baseUrl);
    } catch {
      continue;
    }
    if (url.origin !== baseUrl || !url.pathname.startsWith('/assets/')) continue;
    if (!/\.(?:js|css)$/i.test(url.pathname) || seen.has(url.pathname)) continue;
    seen.add(url.pathname);
    paths.push(url.pathname);
  }
  return paths;
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

async function fetchRequired(url, expectedStatus = 200, expectedType, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { 'cache-control': 'no-cache', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status !== expectedStatus) {
    throw new Error(`${url} returned HTTP ${response.status}; expected ${expectedStatus}.`);
  }
  if (expectedType) {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes(expectedType)) {
      throw new Error(`${url} returned unexpected content type ${contentType || '(missing)'}.`);
    }
  }
  return response;
}

export async function verifyLive(baseUrl = PRODUCTION_URL, expectedVersion = EXPECTED_VERSION) {
  if (baseUrl !== PRODUCTION_URL) {
    throw new Error(`Live verification is restricted to ${PRODUCTION_URL}.`);
  }

  const cacheKey = Date.now().toString(36);
  const healthResponse = await fetchRequired(
    `${baseUrl}/api/health?pipeline-check=${cacheKey}`,
    200,
    'application/json',
  );
  const health = validateHealthPayload(await healthResponse.json(), expectedVersion);
  for (const header of [
    'content-security-policy',
    'strict-transport-security',
    'x-content-type-options',
    'referrer-policy',
  ]) {
    assert(healthResponse.headers.has(header), `Health is missing ${header}.`);
  }
  assert(healthResponse.headers.get('cache-control') === 'no-store', 'Health must not be cached.');

  const httpOrigin = baseUrl.replace(/^https:/, 'http:');
  const redirectResponse = await fetchRequired(
    `${httpOrigin}/release-check?device=phone`,
    308,
    undefined,
    { redirect: 'manual' },
  );
  assert(
    redirectResponse.headers.get('location') === `${baseUrl}/release-check?device=phone`,
    'HTTP did not redirect to the same HTTPS path.',
  );

  for (const path of ['/api/drafts', '/api/memberships', '/api/operations']) {
    const response = await fetchRequired(`${baseUrl}${path}`, 401, 'application/problem+json');
    const body = await response.json();
    assert(body.code === 'UNAUTHENTICATED', `${path} did not deny anonymous access.`);
  }
  const login = await fetchRequired(`${baseUrl}/auth/login`, 302, undefined, {
    redirect: 'manual',
  });
  assert(
    login.headers.get('location')?.startsWith('https://github.com/login/oauth/authorize'),
    'Login did not begin GitHub authorization.',
  );

  const htmlResponse = await fetchRequired(
    `${baseUrl}/?pipeline-check=${cacheKey}`,
    200,
    'text/html',
  );
  const html = await htmlResponse.text();
  validateHtml(html);
  const assets = extractAssetPaths(html, baseUrl);
  if (assets.length === 0)
    throw new Error('Builder HTML did not reference any local build assets.');
  const assetDigests = [];
  for (const assetPath of assets) {
    const expectedType = assetPath.endsWith('.css') ? 'text/css' : 'javascript';
    const response = await fetchRequired(
      `${baseUrl}${assetPath}?pipeline-check=${cacheKey}`,
      200,
      expectedType,
    );
    assetDigests.push(
      createHash('sha256')
        .update(Buffer.from(await response.arrayBuffer()))
        .digest('hex'),
    );
  }

  const production = await fetchRequired(
    `${baseUrl}/content/v1/channels/production?pipeline-check=${cacheKey}`,
    200,
    'application/json',
  );
  const etag = production.headers.get('etag');
  assert(/^"sha256-[a-f0-9]{64}"$/.test(etag ?? ''), 'Production ETag is invalid.');
  const envelope = await production.json();
  assert(envelope.manifestDigest === etag.slice(8, -1), 'ETag does not match manifest digest.');
  const keyResponse = await fetchRequired(
    `${baseUrl}/content/v1/keys/${encodeURIComponent(envelope.signing.keyId)}`,
    200,
    'application/jwk+json',
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
  const cached = await fetchRequired(`${baseUrl}/content/v1/channels/production`, 304, undefined, {
    headers: { 'if-none-match': etag },
  });
  assert(cached.headers.get('etag') === etag, '304 response lost the current ETag.');

  return { url: baseUrl, health, assets, assetDigests, etag };
}

async function main() {
  const result = await verifyLive(process.argv[2] ?? PRODUCTION_URL);
  process.stdout.write(
    `PointApp Builder production is healthy: ${result.health.version}; ${result.assets.length} HTML-derived asset(s) and signed Production content verified.\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
