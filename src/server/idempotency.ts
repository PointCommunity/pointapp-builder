import { digestCanonicalJson } from '../content/crypto';
import { expiry } from '../domain/primitives';
import { parseStoredJson } from './d1';
import { ProblemError } from './problems';

export interface IdempotencyInput {
  actorId: string;
  operation: string;
  key: string;
  body: unknown;
  now?: Date;
}

type IdempotencyClaim = { kind: 'claimed' } | { kind: 'replay'; status: number; body: unknown };

interface StoredIdempotency {
  request_hash: string;
  state: 'in_progress' | 'completed';
  response_status: number | null;
  response_json: string | null;
  expires_at: string;
}

export async function claimIdempotency(
  database: D1Database,
  input: IdempotencyInput,
): Promise<IdempotencyClaim> {
  const now = input.now ?? new Date();
  const requestHash = await digestCanonicalJson(input.body);
  const inserted = await database
    .prepare(
      `INSERT OR IGNORE INTO idempotency_records
       (actor_github_user_id, operation, idempotency_key, request_hash, state, expires_at)
       VALUES (?, ?, ?, ?, 'in_progress', ?)`,
    )
    .bind(input.actorId, input.operation, input.key, requestHash, expiry(now, 24 * 60 * 60))
    .run();

  if ((inserted.meta.changes ?? 0) > 0) return { kind: 'claimed' };

  const stored = await database
    .prepare(
      `SELECT request_hash, state, response_status, response_json, expires_at
       FROM idempotency_records
       WHERE actor_github_user_id = ? AND operation = ? AND idempotency_key = ?`,
    )
    .bind(input.actorId, input.operation, input.key)
    .first<StoredIdempotency>();
  if (!stored)
    throw new ProblemError(409, 'IDEMPOTENCY_CONFLICT', 'The request could not be replayed');
  if (stored.request_hash !== requestHash) {
    throw new ProblemError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'The idempotency key was used for a different request',
    );
  }
  if (stored.state === 'completed' && stored.response_status && stored.response_json) {
    return {
      kind: 'replay',
      status: stored.response_status,
      body: parseStoredJson(stored.response_json),
    };
  }
  throw new ProblemError(
    409,
    'REQUEST_IN_PROGRESS',
    'An identical request is still being processed',
  );
}

export async function completeIdempotency(
  database: D1Database,
  input: IdempotencyInput,
  responseStatus: number,
  responseBody: unknown,
): Promise<void> {
  await database
    .prepare(
      `UPDATE idempotency_records
       SET state = 'completed', response_status = ?, response_json = ?, completed_at = ?
       WHERE actor_github_user_id = ? AND operation = ? AND idempotency_key = ? AND state = 'in_progress'`,
    )
    .bind(
      responseStatus,
      JSON.stringify(responseBody),
      (input.now ?? new Date()).toISOString(),
      input.actorId,
      input.operation,
      input.key,
    )
    .run();
}
