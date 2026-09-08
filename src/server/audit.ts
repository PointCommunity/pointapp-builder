import { z } from 'zod';
import type { Role } from '../domain/access';
import { listRows, parseStoredJson } from './d1';
import { ProblemError } from './problems';

const forbiddenMetadataKey = /(authorization|cookie|credential|private|secret|session|token)/i;
const MetadataSchema = z
  .record(z.string().max(40), z.union([z.string().max(240), z.number(), z.boolean(), z.null()]))
  .refine(
    (metadata) => Object.keys(metadata).every((key) => !forbiddenMetadataKey.test(key)),
    'Audit metadata may not contain credentials or secrets',
  );

export interface AuditActor {
  githubUserId: string;
  role: Role;
  status: 'pending' | 'active' | 'disabled';
}

export interface AuditInput {
  id: string;
  requestId: string;
  actor?: AuditActor;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: 'succeeded' | 'denied' | 'failed';
  reason?: string;
  metadata?: Record<string, boolean | null | number | string>;
  occurredAt?: string;
}

interface AuditRow {
  id: string;
  request_id: string;
  actor_github_user_id: string | null;
  actor_role: Role | null;
  actor_status: AuditActor['status'] | null;
  action: string;
  target_type: string;
  target_id: string | null;
  outcome: AuditInput['outcome'];
  reason: string | null;
  metadata_json: string | null;
  occurred_at: string;
}

export async function appendAuditEvent(database: D1Database, input: AuditInput): Promise<void> {
  let metadata: Record<string, boolean | null | number | string> | undefined;
  try {
    metadata = input.metadata ? MetadataSchema.parse(input.metadata) : undefined;
  } catch {
    throw new ProblemError(400, 'UNSAFE_AUDIT_METADATA', 'Audit metadata is not safe to store');
  }

  await database
    .prepare(
      `INSERT INTO audit_events
       (id, request_id, actor_github_user_id, actor_role, actor_status, action, target_type,
        target_id, outcome, reason, metadata_json, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.requestId,
      input.actor?.githubUserId ?? null,
      input.actor?.role ?? null,
      input.actor?.status ?? null,
      input.action,
      input.targetType,
      input.targetId ?? null,
      input.outcome,
      input.reason ?? null,
      metadata ? JSON.stringify(metadata) : null,
      input.occurredAt ?? new Date().toISOString(),
    )
    .run();
}

export async function listAuditEvents(database: D1Database, limit: number, before?: string) {
  const rows = await listRows<AuditRow>(
    database
      .prepare(
        `SELECT id, request_id, actor_github_user_id, actor_role, actor_status, action,
                target_type, target_id, outcome, reason, metadata_json, occurred_at
         FROM audit_events
         WHERE (? IS NULL OR occurred_at < ?)
         ORDER BY occurred_at DESC, id DESC LIMIT ?`,
      )
      .bind(before ?? null, before ?? null, limit + 1),
  );
  const visible = rows.slice(0, limit);
  return {
    items: visible.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      actorGithubUserId: row.actor_github_user_id,
      actorRole: row.actor_role,
      actorStatus: row.actor_status,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      outcome: row.outcome,
      reason: row.reason,
      metadata: row.metadata_json
        ? parseStoredJson<Record<string, boolean | null | number | string>>(row.metadata_json)
        : null,
      occurredAt: row.occurred_at,
    })),
    nextCursor: rows.length > limit ? (visible.at(-1)?.occurred_at ?? null) : null,
  };
}
