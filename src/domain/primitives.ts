import { z } from 'zod';

export const IdSchema = z.uuid();
export const CursorSchema = z.string().min(1).max(256);
export const PageLimitSchema = z.coerce.number().int().min(1).max(100).default(25);

export function boundedText(maximum: number, minimum = 1) {
  return z.string().trim().min(minimum).max(maximum);
}

export function isoNow(now = new Date()): string {
  return now.toISOString();
}

export function expiry(now: Date, lifetimeSeconds: number): string {
  return new Date(now.getTime() + lifetimeSeconds * 1_000).toISOString();
}
