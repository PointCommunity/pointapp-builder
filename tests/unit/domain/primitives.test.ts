import { describe, expect, it } from 'vitest';
import {
  CursorSchema,
  IdSchema,
  PageLimitSchema,
  boundedText,
} from '../../../src/domain/primitives';

describe('domain primitives', () => {
  it('accepts UUID identifiers and bounded page sizes', () => {
    expect(IdSchema.parse('25d9f45b-03df-4190-bb50-23211d5cc832')).toBe(
      '25d9f45b-03df-4190-bb50-23211d5cc832',
    );
    expect(PageLimitSchema.parse('25')).toBe(25);
  });

  it('rejects unbounded identifiers cursors and text', () => {
    expect(() => IdSchema.parse('../owner')).toThrow();
    expect(() => CursorSchema.parse('x'.repeat(257))).toThrow();
    expect(() => boundedText(8).parse('x'.repeat(9))).toThrow();
  });
});
