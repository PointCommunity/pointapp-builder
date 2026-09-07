import { describe, expect, it } from 'vitest';
import { can, canManageRole, type Role } from '../../src/domain/access';

describe('PointApp Builder access policy', () => {
  it.each<[Role, boolean]>([
    ['editor', false],
    ['publisher', true],
    ['administrator', true],
    ['owner', true],
  ])('%s staging permission is %s', (role, expected) => {
    expect(can(role, 'staging:publish')).toBe(expected);
  });

  it.each<[Role, boolean]>([
    ['editor', false],
    ['publisher', false],
    ['administrator', true],
    ['owner', true],
  ])('%s production permission is %s', (role, expected) => {
    expect(can(role, 'production:promote')).toBe(expected);
  });

  it('allows administrators to manage editors and publishers only', () => {
    expect(canManageRole('administrator', 'editor')).toBe(true);
    expect(canManageRole('administrator', 'publisher')).toBe(true);
    expect(canManageRole('administrator', 'administrator')).toBe(false);
    expect(canManageRole('administrator', 'owner')).toBe(false);
  });

  it('reserves administrator and ownership management for owners', () => {
    expect(canManageRole('owner', 'administrator')).toBe(true);
    expect(canManageRole('owner', 'owner')).toBe(true);
    expect(canManageRole('publisher', 'editor')).toBe(false);
  });
});
