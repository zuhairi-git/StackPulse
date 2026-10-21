import type { Resource } from '../model';
import { read, object, items, text } from './http';
export async function vercel(token: string, scope: string, signal: AbortSignal) {
  const url = new URL('https://api.vercel.com/v7/deployments'); url.searchParams.set('limit', '20'); if (scope) url.searchParams.set('teamId', scope);
  const data = object(await read(url, token, signal));
  const resources: Resource[] = items(data.deployments).map(d => ({ id: text(d.uid, text(d.id)), name: text(d.name), detail: text(d.target, 'Preview') + (typeof d.url === 'string' ? ` · ${d.url}` : ''), status: text(d.state, text(d.readyState)), url: 'https://vercel.com/dashboard' }));
  return { resources, note: 'Latest 20 deployments · deployment state, not application uptime' };
}
