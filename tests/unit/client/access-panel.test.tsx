import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccessPanel } from '../../../src/client/panels/AccessPanel';
import type { MembershipView } from '../../../src/client/api';

const pending: MembershipView = {
  githubUserId: '2',
  login: 'new-editor',
  displayName: 'New Editor',
  avatarUrl: null,
  role: 'editor',
  status: 'pending',
  version: 1,
  requestedAt: '2026-09-07T12:00:00.000Z',
  approvedAt: null,
  disabledAt: null,
};

describe('Access panel', () => {
  it('presents new users as Pending Editors and submits explicit Owner approval', async () => {
    const update = vi.fn().mockResolvedValue({ ...pending, status: 'active', version: 2 });
    render(<AccessPanel initialItems={[pending]} updateMembership={update} />);

    expect(screen.getByText('@new-editor')).toBeVisible();
    expect(screen.getByText('Pending')).toBeVisible();
    expect(screen.getByLabelText('Role for @new-editor')).toHaveValue('editor');
    fireEvent.click(screen.getByRole('button', { name: 'Approve @new-editor' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        '2',
        expect.objectContaining({ expectedVersion: 1, role: 'editor', status: 'active' }),
      ),
    );
    expect(await screen.findByText('Active')).toBeVisible();
  });
});
