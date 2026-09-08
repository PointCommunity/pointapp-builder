import { describe, expect, it } from 'vitest';
import {
  capabilities,
  can,
  canManageMembership,
  roles,
  type MembershipStatus,
} from '../../../src/domain/access';

describe('server-side access matrix', () => {
  it('grants no capability to Pending or Disabled memberships', () => {
    for (const role of roles) {
      for (const status of ['pending', 'disabled'] satisfies MembershipStatus[]) {
        for (const capability of capabilities)
          expect(can({ role, status }, capability)).toBe(false);
      }
    }
  });

  it('gives Active Owner every declared capability', () => {
    for (const capability of capabilities) {
      expect(can({ role: 'owner', status: 'active' }, capability)).toBe(true);
    }
  });

  it('keeps Staging at Publisher and Production at Administrator', () => {
    expect(can({ role: 'editor', status: 'active' }, 'staging:publish')).toBe(false);
    expect(can({ role: 'publisher', status: 'active' }, 'staging:publish')).toBe(true);
    expect(can({ role: 'publisher', status: 'active' }, 'production:promote')).toBe(false);
    expect(can({ role: 'administrator', status: 'active' }, 'production:promote')).toBe(true);
    expect(can({ role: 'administrator', status: 'active' }, 'production:rollback')).toBe(false);
    expect(can({ role: 'owner', status: 'active' }, 'production:rollback')).toBe(true);
  });

  it('allows Administrators to manage only Editor and Publisher targets and assignments', () => {
    expect(canManageMembership('administrator', 'editor', 'publisher')).toBe(true);
    expect(canManageMembership('administrator', 'publisher', 'editor')).toBe(true);
    expect(canManageMembership('administrator', 'administrator', 'editor')).toBe(false);
    expect(canManageMembership('administrator', 'editor', 'administrator')).toBe(false);
    expect(canManageMembership('owner', 'owner', 'administrator')).toBe(true);
  });
});
