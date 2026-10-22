import { read, object, items, text } from './http';
export async function cloudflare(token: string, scope: string, signal: AbortSignal) {
  const url = new URL('https://api.cloudflare.com/client/v4/zones'); url.searchParams.set('per_page', '20'); if (scope) url.searchParams.set('account.id', scope);
  const data = object(await read(url, token, signal)); if (data.success !== true) throw new Error('Cloudflare could not list zones. Check Zone Read permissions.');
  const zones = items(data.result);
  const accounts = new Map<string, string>();
  for (const zone of zones) {
    if (zone.account && typeof zone.account === 'object') {
      const account = object(zone.account);
      if (typeof account.id === 'string' && typeof account.name === 'string' && (!scope || account.id === scope)) accounts.set(account.id, account.name);
    }
  }
  // A token may cover several accounts. Never label the whole connection with just the first one.
  const accountName = accounts.size === 1 ? [...accounts.values()][0] : accounts.size > 1 ? 'Multiple accounts' : undefined;
  return { resources: zones.map(z => ({ id: text(z.id), name: text(z.name), detail: text(z.type, 'Zone'), status: text(z.status), url: 'https://dash.cloudflare.com' })), accountName, note: 'First 20 zones · zone state, not edge availability or traffic' };
}
