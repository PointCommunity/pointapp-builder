import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { sampleManifest } from '../../src/content/manifest';
import { AppPreview } from '../../src/preview/AppPreview';

describe('PointApp staging preview', () => {
  it.each(['phone', 'tablet'] as const)('renders the manifest in the %s frame', (device) => {
    render(<AppPreview device={device} manifest={sampleManifest} />);

    expect(screen.getByTestId('app-preview')).toHaveAttribute('data-device', device);
    expect(screen.getByRole('heading', { name: /find your people/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'PointApp tabs' })).toHaveTextContent('Events');
  });
});
