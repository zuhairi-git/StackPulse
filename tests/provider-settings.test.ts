import { afterEach, describe, expect, it, vi } from 'vitest';
import { providers } from '../src/model';
import { connectionsForProviders, loadEnabledProviders, parseEnabledProviders, providerSettingsKey } from '../src/provider-settings';

afterEach(() => vi.unstubAllGlobals());
describe('provider activation', () => {
  it('preserves the existing workspace by enabling the bundled providers on first use', () => {
    expect(parseEnabledProviders(null)).toEqual(providers);
  });
  it('restores an explicitly empty selection and filters unknown or duplicate integrations', () => {
    expect(parseEnabledProviders('[]')).toEqual([]);
    expect(parseEnabledProviders('["neon","neon","future-provider"]')).toEqual(['neon']);
    expect(parseEnabledProviders('{"neon":true}')).toEqual(providers);
    expect(parseEnabledProviders('corrupt data')).toEqual(providers);
  });
  it('loads saved settings on restart and handles unavailable browser storage', () => {
    const getItem = vi.fn(() => '["cloudflare"]');
    vi.stubGlobal('localStorage', { getItem });
    expect(loadEnabledProviders()).toEqual(['cloudflare']);
    expect(getItem).toHaveBeenCalledWith(providerSettingsKey);
    getItem.mockImplementation(() => { throw new Error('Storage unavailable'); });
    expect(loadEnabledProviders()).toEqual(providers);
  });
  it('excludes every disabled account from refresh and display selections without deleting its data', () => {
    const saved = [
      { id: 'work', provider: 'vercel' as const }, { id: 'personal', provider: 'vercel' as const },
      { id: 'database', provider: 'neon' as const },
    ];
    expect(connectionsForProviders(saved, ['neon']).map(c => c.id)).toEqual(['database']);
    expect(connectionsForProviders(saved, [])).toEqual([]);
    expect(connectionsForProviders(saved, ['vercel', 'neon'])).toEqual(saved);
    expect(saved).toHaveLength(3);
  });
});
