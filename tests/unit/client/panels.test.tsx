import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { sampleManifest } from '../../../src/content/manifest';
import { AudiencePanel } from '../../../src/client/panels/AudiencePanel';
import { BrandingPanel } from '../../../src/client/panels/BrandingPanel';
import { ContentPanel } from '../../../src/client/panels/ContentPanel';
import { NavigationPanel } from '../../../src/client/panels/NavigationPanel';
import { NotificationsPanel } from '../../../src/client/panels/NotificationsPanel';
import { SettingsPanel } from '../../../src/client/panels/SettingsPanel';

describe('persistent manifest panels', () => {
  it('emits immutable manifest updates for content, branding, audience, campaigns, and settings', () => {
    const onChange = vi.fn();
    const { rerender } = render(<BrandingPanel manifest={sampleManifest} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('App name'), { target: { value: 'Point Mobile' } });
    expect(onChange.mock.lastCall?.[0].app.name).toBe('Point Mobile');
    rerender(<AudiencePanel manifest={sampleManifest} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add audience' }));
    expect(onChange.mock.lastCall?.[0].audiences).toHaveLength(2);
    rerender(<NotificationsPanel manifest={sampleManifest} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'New campaign' }));
    expect(onChange.mock.lastCall?.[0].campaigns).toHaveLength(1);
    rerender(<SettingsPanel manifest={sampleManifest} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Refresh interval (seconds)'), {
      target: { value: '120' },
    });
    expect(onChange.mock.lastCall?.[0].settings.refreshSeconds).toBe(120);
  });
  it('adds and reorders screen content and edits navigation', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ContentPanel manifest={sampleManifest} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Edit Home' })).toHaveClass('screen-selector');
    fireEvent.change(screen.getByLabelText('Add element'), { target: { value: 'scripture' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to Home/ }));
    expect(onChange.mock.lastCall?.[0].screens[0].elements.at(-1).type).toBe('scripture');
    rerender(<NavigationPanel manifest={sampleManifest} onChange={onChange} />);
    fireEvent.change(screen.getAllByLabelText('Label')[0], { target: { value: 'Start' } });
    expect(onChange.mock.lastCall?.[0].navigation[0].label).toBe('Start');
  });
});
