import { ProblemError } from './problems';

export type RateLimitBinding = Pick<RateLimit, 'limit'>;

export async function consumeRateLimit(
  binding: RateLimitBinding,
  actorKey: string,
  operation: string,
): Promise<void> {
  const { success } = await binding.limit({ key: `${actorKey}:${operation}` });
  if (!success) {
    throw new ProblemError(429, 'RATE_LIMITED', 'Too many requests; try again shortly');
  }
}
