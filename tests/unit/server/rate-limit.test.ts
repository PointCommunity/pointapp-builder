import { describe, expect, it } from 'vitest';
import { consumeRateLimit } from '../../../src/server/rate-limit';
import { ProblemError } from '../../../src/server/problems';

describe('Cloudflare rate-limit adapter', () => {
  it('uses an actor and operation key and permits a successful result', async () => {
    let received = '';
    await consumeRateLimit(
      { limit: async ({ key }) => ((received = key), { success: true }) },
      'actor:1202831',
      'draft:save',
    );
    expect(received).toBe('actor:1202831:draft:save');
  });

  it('returns a typed 429 without treating the limiter as authorization', async () => {
    await expect(
      consumeRateLimit({ limit: async () => ({ success: false }) }, 'actor:2', 'release:publish'),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ProblemError>>({ status: 429, code: 'RATE_LIMITED' }),
    );
  });
});
