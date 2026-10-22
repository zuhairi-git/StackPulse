import type { Provider, Snapshot } from '../model';
import { providerRegistry, type ProviderDefinition } from './registry';
export async function fetchSnapshot(provider: Provider, token: string, scope: string, signal: AbortSignal, connectionId = `legacy:${provider}`): Promise<Snapshot> {
  try {
    const adapter: ProviderDefinition = providerRegistry[provider];
    const result = await adapter.fetch(token, scope, signal);
    // Name lookup has its own short timeout so it cannot discard a successful inventory read.
    const nameSignal = AbortSignal.any([signal, AbortSignal.timeout(3000)]);
    const name = result.accountName || await adapter.discoverName?.(token, scope, nameSignal).catch(() => undefined);
    return { connectionId, provider, ...result, accountName: name, at: Date.now() };
  }
  catch (error) {
    if (signal.aborted) throw new Error('Request stopped or timed out. Cached data was preserved.');
    if (error instanceof TypeError) throw new Error('Browser could not reach this API. CORS, connectivity, or a browser extension may be blocking it. No proxy is used.');
    throw error;
  }
}
export async function checkBrowser(provider: Provider): Promise<boolean> {
  const url = providerRegistry[provider].probeURL;
  // A deliberately invalid sentinel tests the Authorization preflight without a credential.
  const response = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', headers: { Authorization: 'Bearer stackpulse-cors-probe-not-a-token' }, signal: AbortSignal.timeout(12000) });
  return response.status === 401 || response.status === 403 || response.ok;
}
