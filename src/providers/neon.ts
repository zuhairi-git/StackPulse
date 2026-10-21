import { read, object, items, text } from './http';
export async function neon(token: string, scope: string, signal: AbortSignal) {
  const url = new URL('https://console.neon.tech/api/v2/projects'); url.searchParams.set('limit', '20'); if (scope) url.searchParams.set('org_id', scope);
  const data = object(await read(url, token, signal));
  return { resources: items(data.projects).map(p => ({ id: text(p.id), name: text(p.name), detail: text(p.region_id), status: 'Listed', url: 'https://console.neon.tech' })), note: 'First 20 projects · inventory only; compute health is not reported' };
}
