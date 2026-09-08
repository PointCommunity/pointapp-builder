import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../../src/client/components/feedback/ConfirmDialog';
import { ValidationSummary } from '../../../src/client/components/feedback/ValidationSummary';

describe('accessible feedback', () => {
  it('focuses the safe action, traps button focus, and supports Escape', () => {
    const cancel = vi.fn();
    render(
      <ConfirmDialog
        title="Discard edits?"
        message="Unsaved work remains."
        confirmLabel="Discard"
        onConfirm={vi.fn()}
        onCancel={cancel}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Discard edits?' });
    const safe = screen.getByRole('button', { name: 'Keep editing' });
    const destructive = screen.getByRole('button', { name: 'Discard' });
    expect(safe).toHaveFocus();
    destructive.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(safe).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('announces bounded validation issues', () => {
    render(<ValidationSummary issues={['screens.0.title: Required']} />);
    expect(screen.getByRole('alert')).toHaveTextContent('screens.0.title: Required');
  });
});
