type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const encoder = new TextEncoder();

function normalize(value: unknown): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError('Canonical JSON requires a finite JSON number');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
        throw new TypeError('Unsupported canonical JSON value');
      }
      result[key] = normalize(item);
    }
    return result;
  }
  throw new TypeError('Unsupported canonical JSON value');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64urlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function digestCanonicalJson(value: unknown): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(canonicalJson(value))),
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function digestBytes(value: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer),
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
}

export async function exportPublicJwk(publicKey: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', publicKey);
}

export function importPrivateJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign']);
}

export function importPublicJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['verify']);
}

export async function signCanonicalJson(privateKey: CryptoKey, value: unknown): Promise<string> {
  const signature = await crypto.subtle.sign(
    'Ed25519',
    privateKey,
    encoder.encode(canonicalJson(value)),
  );
  return bytesToBase64url(new Uint8Array(signature));
}

export async function verifyCanonicalJson(
  publicJwk: JsonWebKey,
  value: unknown,
  signature: string,
): Promise<boolean> {
  return crypto.subtle.verify(
    'Ed25519',
    await importPublicJwk(publicJwk),
    Uint8Array.from(base64urlToBytes(signature)).buffer,
    encoder.encode(canonicalJson(value)),
  );
}
