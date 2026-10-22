import { meta, providers, type Provider } from './model';

export const providerSettingsKey = 'stackpulse-enabled-providers';
export const defaultProviders = () => providers.filter(p => meta[p].defaultEnabled);

export function parseEnabledProviders(raw: string | null): Provider[] {
  if (raw === null) return defaultProviders();
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(p => typeof p === 'string')) return defaultProviders();
    return providers.filter(p => value.includes(p));
  } catch { return defaultProviders(); }
}

export function loadEnabledProviders(): Provider[] {
  try { return parseEnabledProviders(localStorage.getItem(providerSettingsKey)); }
  catch { return defaultProviders(); }
}

export function connectionsForProviders<T extends { provider: Provider }>(connections: T[], enabled: Provider[]): T[] {
  return connections.filter(c => enabled.includes(c.provider));
}
