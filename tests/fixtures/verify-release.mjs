import { webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { TextEncoder } from 'node:util';

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
}
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const { envelope, publicJwk } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const { signing, ...unsigned } = envelope;
const key = await webcrypto.subtle.importKey('jwk', publicJwk, { name: 'Ed25519' }, false, [
  'verify',
]);
const valid = await webcrypto.subtle.verify(
  'Ed25519',
  key,
  Buffer.from(signing.signature, 'base64url'),
  new TextEncoder().encode(canonical(unsigned)),
);
process.stdout.write(valid ? 'verified\n' : 'invalid\n');
process.exitCode = valid ? 0 : 1;
