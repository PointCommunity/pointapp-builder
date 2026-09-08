// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

describe('Builder completeness guard', () => {
  it('contains no prototype role switcher, disconnected success, or deferred panel copy', () => {
    const files = [
      'src/client/App.tsx',
      ...[
        'ContentPanel',
        'LibraryPanel',
        'NavigationPanel',
        'BrandingPanel',
        'AudiencePanel',
        'NotificationsPanel',
        'ReleasesPanel',
        'AccessPanel',
        'SettingsPanel',
        'OperationsPanel',
      ].map((name) => `src/client/panels/${name}.tsx`),
    ];
    const source = files.map((file) => readFileSync(resolve(file), 'utf8')).join('\n');
    expect(source).not.toMatch(
      /foundation mode|intentionally disconnected|bounded for a later|role switch/i,
    );
  });
});
