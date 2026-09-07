import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/client/App';

describe('PointApp Builder foundation shell', () => {
  it('keeps release actions disconnected and follows the selected role policy', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Releases' }));

    const staging = screen.getByRole('button', { name: 'Publish to Staging' });
    const production = screen.getByRole('button', { name: 'Promote Staging to Production' });
    expect(staging).toBeDisabled();
    expect(production).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Foundation role'), { target: { value: 'publisher' } });
    expect(staging).toBeEnabled();
    expect(production).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Foundation role'), {
      target: { value: 'administrator' },
    });
    expect(production).toBeEnabled();
  });

  it('switches the shared staging preview between phone and tablet frames', () => {
    render(<App />);
    const preview = screen.getByTestId('app-preview');
    expect(preview).toHaveAttribute('data-device', 'phone');

    fireEvent.click(screen.getByRole('button', { name: 'Tablet preview' }));
    expect(preview).toHaveAttribute('data-device', 'tablet');
  });

  it('exposes each planned panel independently', () => {
    render(<App />);
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
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });
});
