import { ProblemError } from './problems';

const IDEMPOTENCY_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireMutationHeaders(
  request: Request,
  allowedOrigin: string,
  allowedContentTypes: readonly string[],
  maxBytes: number,
): void {
  if (request.headers.get('origin') !== allowedOrigin) {
    throw new ProblemError(403, 'ORIGIN_DENIED', 'The request origin is not allowed');
  }
  if (request.headers.get('sec-fetch-site') !== 'same-origin') {
    throw new ProblemError(403, 'FETCH_METADATA_DENIED', 'Cross-site requests are not allowed');
  }

  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (!contentType || !allowedContentTypes.includes(contentType)) {
    throw new ProblemError(415, 'CONTENT_TYPE_REQUIRED', `Use ${allowedContentTypes.join(' or ')}`);
  }
  if (!IDEMPOTENCY_KEY.test(request.headers.get('idempotency-key') ?? '')) {
    throw new ProblemError(400, 'IDEMPOTENCY_REQUIRED', 'A valid Idempotency-Key is required');
  }

  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > maxBytes) {
    throw new ProblemError(413, 'REQUEST_TOO_LARGE', 'The request body is too large');
  }
}

export async function readJsonMutation(
  request: Request,
  allowedOrigin: string,
  maxBytes = 1_048_576,
): Promise<unknown> {
  requireMutationHeaders(request, allowedOrigin, ['application/json'], maxBytes);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ProblemError(413, 'REQUEST_TOO_LARGE', 'The request body is too large');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProblemError(400, 'INVALID_JSON', 'The request body is not valid JSON');
  }
}

export function applySecurityHeaders(
  response: Response,
  options: { cacheControl?: string; contentSecurityPolicy?: string } = {},
): Response {
  const headers = new Headers(response.headers);
  headers.set(
    'cache-control',
    options.cacheControl ?? response.headers.get('cache-control') ?? 'no-store',
  );
  headers.set(
    'content-security-policy',
    options.contentSecurityPolicy ?? "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  headers.set('cross-origin-opener-policy', 'same-origin');
  headers.set('cross-origin-resource-policy', 'same-origin');
  headers.set('permissions-policy', 'camera=(), geolocation=(), microphone=(), payment=(), usb=()');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
