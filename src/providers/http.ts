export async function read(url: URL, token: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal });
  if (response.status === 401 || response.status === 403) throw new Error('Access denied. Check the token, its permissions, and the selected account scope.');
  if (response.status === 429) throw new Error('Provider rate limit reached. Wait before refreshing again.');
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}. Try again later.`);
  return response.json();
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected provider response.');
  return value as Record<string, unknown>;
}
export function items(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('Provider response is missing its resource list.');
  return value.map(object);
}
export function text(value: unknown, fallback = 'Unknown') { return typeof value === 'string' ? value : fallback; }
