import { read, object, items, text } from './http';
export async function cloudflare(token: string, scope: string, signal: AbortSignal) {
  const url = new URL('https://api.cloudflare.com/client/v4/zones'); url.searchParams.set('per_page', '20'); if (scope) url.searchParams.set('account.id', scope);
  const data = object(await read(url, token, signal)); if (data.success !== true) throw new Error('Cloudflare could not list zones. Check Zone Read permissions.');
  return { resources: items(data.result).map(z => ({ id: text(z.id), name: text(z.name), detail: text(z.type, 'Zone'), status: text(z.status), url: 'https://dash.cloudflare.com' })), note: 'First 20 zones · zone state, not edge availability or traffic' };
}
