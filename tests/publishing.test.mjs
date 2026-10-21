import { describe, expect, it } from 'vitest';
import { normalizeBasePath, resolvePublishing } from '../scripts/publishing.mjs';

const config = { defaultTarget: 'static', targets: { static: { basePath: '/' }, 'github-pages': { repository: 'owner/StackPulse' } } };
describe('portable publishing configuration', () => {
  it('builds root-hosted sites by default and project Pages under the repository name', () => {
    expect(resolvePublishing(config).basePath).toBe('/');
    expect(resolvePublishing(config, { target: 'github-pages' }).basePath).toBe('/StackPulse/');
    expect(resolvePublishing(config, { target: 'github-pages', repository: 'owner/Renamed' }).basePath).toBe('/Renamed/');
    expect(resolvePublishing(config, { target: 'github-pages', repository: 'owner/stack.pulse' }).basePath).toBe('/stack.pulse/');
  });
  it('supports user Pages, custom domains and explicit nested host paths', () => {
    expect(resolvePublishing(config, { target: 'github-pages', repository: 'Owner/owner.github.io' }).basePath).toBe('/');
    expect(resolvePublishing(config, { target: 'github-pages', basePath: '' }).basePath).toBe('/');
    expect(resolvePublishing(config, { basePath: '/tools/pulse' }).basePath).toBe('/tools/pulse/');
  });
  it('fails early on unsafe paths or unknown publishing targets', () => {
    for (const value of ['https://host/', '//host/', '/../x/', '/x?y', '/x#y', '/a/./b', '/a\\b']) expect(() => normalizeBasePath(value)).toThrow();
    expect(() => resolvePublishing(config, { target: 'typo' })).toThrow('Unknown');
  });
});
