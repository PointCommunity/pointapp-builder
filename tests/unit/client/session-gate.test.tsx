import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionGate, type SessionView } from '../../../src/client/components/SessionGate';

const membership = {
  githubUserId: '2',
  login: 'editor',
  displayName: 'Editor',
  avatarUrl: null,
  role: 'editor' as const,
  status: 'pending' as const,
  version: 1,
  requestedAt: '2026-09-07T12:00:00.000Z',
  approvedAt: null,
  disabledAt: null,
};

function view(state: SessionView['state']): SessionView {
  return {
    state,
    membership:
      state === 'pending' || state === 'disabled' || state === 'active'
        ? { ...membership, status: state === 'active' ? 'active' : state }
        : null,
    capabilities: [],
  };
}

describe('session gate', () => {
  it('shows a first-time GitHub login without protected workspace content', () => {
    render(
      <SessionGate session={view('signed-out')}>
        <div>Protected workspace</div>
      </SessionGate>,
    );
    expect(screen.getByRole('link', { name: /sign in with github/i })).toHaveAttribute(
      'href',
      '/auth/login',
    );
    expect(screen.queryByText('Protected workspace')).not.toBeInTheDocument();
  });

  it('clearly identifies Pending and Disabled access without leaking content', () => {
    const { rerender } = render(
      <SessionGate session={view('pending')}>
        <div>Protected workspace</div>
      </SessionGate>,
    );
    expect(screen.getByRole('heading', { name: /access request pending/i })).toBeVisible();
    rerender(
      <SessionGate session={view('disabled')}>
        <div>Protected workspace</div>
      </SessionGate>,
    );
    expect(screen.getByRole('heading', { name: /access is disabled/i })).toBeVisible();
    expect(screen.queryByText('Protected workspace')).not.toBeInTheDocument();
  });

  it('renders the workspace only for an Active membership', () => {
    render(
      <SessionGate session={view('active')}>
        <div>Protected workspace</div>
      </SessionGate>,
    );
    expect(screen.getByText('Protected workspace')).toBeVisible();
  });

  it('fails closed when an unexpected session state reaches the client', () => {
    render(
      <SessionGate
        session={{
          state: 'unexpected' as SessionView['state'],
          membership: null,
          capabilities: [],
        }}
      >
        <div>Protected workspace</div>
      </SessionGate>,
    );
    expect(
      screen.getByRole('heading', { name: /sign-in is temporarily unavailable/i }),
    ).toBeVisible();
    expect(screen.queryByText('Protected workspace')).not.toBeInTheDocument();
  });
});
