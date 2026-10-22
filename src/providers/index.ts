import type { Provider, Snapshot } from '../model';
import { vercel } from './vercel';
import { neon } from './neon';
import { cloudflare } from './cloudflare';
import { accountName } from './account';
const adapters = { vercel, neon, cloudflare };
export async function fetchSnapshot(provider: Provider, token: string, scope: string, signal: AbortSignal, connectionId = `legacy:${provider}`): Promise<Snapshot> {
  try {
    const result = await adapters[provider](token, scope, signal);
    // Name lookup has its own short timeout so it cannot discard a successful inventory read.
    const nameSignal = AbortSignal.any([signal, AbortSignal.timeout(3000)]);
    const name = provider === 'cloudflare'
      ? ('accountName' in result && typeof result.accountName === 'string' ? result.accountName : undefined)
      : await accountName(provider, token, scope, nameSignal);
    return { connectionId, provider, ...result, accountName: name, at: Date.now() };
  }
  catch (error) {
    if (signal.aborted) throw new Error('Request stopped or timed out. Cached data was preserved.');
    if (error instanceof TypeError) throw new Error('Browser could not reach this API. CORS, connectivity, or a browser extension may be blocking it. No proxy is used.');
    throw error;
  }
}
export async function checkBrowser(provider: Provider): Promise<boolean> {
  const url = { vercel: 'https://api.vercel.com/v7/deployments?limit=1', neon: 'https://console.neon.tech/api/v2/projects?limit=1', cloudflare: 'https://api.cloudflare.com/client/v4/zones?per_page=1' }[provider];
  // A deliberately invalid sentinel tests the Authorization preflight without a credential.
  const response = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', headers: { Authorization: 'Bearer stackpulse-cors-probe-not-a-token' }, signal: AbortSignal.timeout(12000) });
  return response.status === 401 || response.status === 403 || response.ok;
}
