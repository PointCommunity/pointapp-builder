// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { appendAuditEvent, listAuditEvents } from '../../src/server/audit';
import { claimIdempotency, completeIdempotency } from '../../src/server/idempotency';
import { ProblemError } from '../../src/server/problems';
import { SQLiteD1Database } from '../helpers/sqlite-d1';

function database() {
  const db = new SQLiteD1Database();
  db.applyMigrations();
  db.database
    .prepare(
      "INSERT INTO memberships (github_user_id, login, role, status) VALUES ('1202831', 'brimdor', 'owner', 'active')",
    )
    .run();
  return db;
}

describe('idempotent mutations', () => {
  it('claims once and replays the completed safe response', async () => {
    const db = database();
    const input = {
      actorId: '1202831',
      operation: 'draft:create',
      key: '4ddde8e1-a3f5-46b6-a900-3837da842356', // gitleaks:allow - UUID fixture
      body: { name: 'Sunday' },
      now: new Date('2026-09-07T12:00:00Z'),
    };

    await expect(claimIdempotency(db, input)).resolves.toEqual({ kind: 'claimed' });
    await completeIdempotency(db, input, 201, { id: 'draft-1' });
    await expect(claimIdempotency(db, input)).resolves.toEqual({
      kind: 'replay',
      status: 201,
      body: { id: 'draft-1' },
    });
  });

  it('rejects reuse of a key with a different normalized request', async () => {
    const db = database();
    const base = {
      actorId: '1202831',
      operation: 'draft:create',
      key: '4ddde8e1-a3f5-46b6-a900-3837da842356', // gitleaks:allow - UUID fixture
      now: new Date('2026-09-07T12:00:00Z'),
    };
    await claimIdempotency(db, { ...base, body: { name: 'Sunday' } });

    await expect(claimIdempotency(db, { ...base, body: { name: 'Changed' } })).rejects.toEqual(
      expect.objectContaining<Partial<ProblemError>>({ status: 409, code: 'IDEMPOTENCY_CONFLICT' }),
    );
  });
});

describe('audit events', () => {
  it('stores bounded safe metadata and returns newest events first', async () => {
    const db = database();
    await appendAuditEvent(db, {
      id: '25d9f45b-03df-4190-bb50-23211d5cc832',
      requestId: '0c5df84c-d37d-4e16-8669-a566513ee42f',
      actor: { githubUserId: '1202831', role: 'owner', status: 'active' },
      action: 'membership.approve',
      targetType: 'membership',
      targetId: '2',
      outcome: 'succeeded',
      metadata: { role: 'editor' },
      occurredAt: '2026-09-07T12:00:00.000Z',
    });

    await expect(listAuditEvents(db, 25)).resolves.toMatchObject({
      items: [
        {
          action: 'membership.approve',
          targetId: '2',
          metadata: { role: 'editor' },
        },
      ],
      nextCursor: null,
    });
  });

  it('rejects metadata keys that could carry secrets', async () => {
    const db = database();
    await expect(
      appendAuditEvent(db, {
        id: '25d9f45b-03df-4190-bb50-23211d5cc832',
        requestId: '0c5df84c-d37d-4e16-8669-a566513ee42f',
        actor: { githubUserId: '1202831', role: 'owner', status: 'active' },
        action: 'auth.callback',
        targetType: 'session',
        outcome: 'failed',
        metadata: { accessToken: 'never-store-me' },
        occurredAt: '2026-09-07T12:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'UNSAFE_AUDIT_METADATA' });
  });
});
