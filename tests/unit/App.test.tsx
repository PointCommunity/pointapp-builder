import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/client/App';

describe('PointApp Builder foundation shell', () => {
  const session = {
    state: 'active' as const,
    membership: {
      githubUserId: '1202831',
      login: 'brimdor',
      displayName: 'Chris',
      avatarUrl: null,
      role: 'owner' as const,
      status: 'active' as const,
      version: 1,
      requestedAt: '2026-09-07T12:00:00.000Z',
      approvedAt: '2026-09-07T12:00:00.000Z',
      disabledAt: null,
    },
    capabilities: ['staging:publish', 'production:promote'] as const,
  };

  it('uses the authenticated role and has no role-switching control', () => {
    render(<App initialSession={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Releases' }));

    const staging = screen.getByRole('button', { name: 'Publish to Staging' });
    const production = screen.getByRole('button', { name: 'Promote Staging to Production' });
    expect(staging).toBeDisabled();
    expect(production).toBeDisabled();
    expect(screen.queryByLabelText('Foundation role')).not.toBeInTheDocument();
    expect(screen.getByText('@brimdor')).toBeVisible();
  });

  it('switches the shared staging preview between phone and tablet frames', () => {
    render(<App initialSession={session} />);
    const preview = screen.getByTestId('app-preview');
    expect(preview).toHaveAttribute('data-device', 'phone');

    fireEvent.click(screen.getByRole('button', { name: 'Tablet preview' }));
    expect(preview).toHaveAttribute('data-device', 'tablet');
  });

  it('exposes each planned panel independently', () => {
    render(<App initialSession={session} />);
    for (const label of [
      'Content',
      'Library',
      'Navigation',
      'Branding',
      'Audience',
      'Notifications',
      'Releases',
      'Access',
      'Settings',
      'Operations',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });
});
