import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { sampleManifest } from '../../../src/content/manifest';
import { NavigationPanel } from '../../../src/client/panels/NavigationPanel';

describe('keyboard-operable controls', () => {
  it('uses native focusable buttons and form controls for editing', () => {
    const onChange = vi.fn();
    render(<NavigationPanel manifest={sampleManifest} onChange={onChange} />);
    const label = screen.getAllByLabelText('Label')[0];
    label.focus();
    expect(label).toHaveFocus();
    fireEvent.change(label, { target: { value: 'Start' } });
    expect(onChange).toHaveBeenCalled();
    const move = screen.getAllByRole('button', { name: 'Up' })[1];
    move.focus();
    expect(move).toHaveFocus();
  });
});
