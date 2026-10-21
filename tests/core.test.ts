import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { encrypt, decrypt, all, save, remove } from '../src/storage';
import { stale, type Connection, type Snapshot } from '../src/model';
import { fetchSnapshot } from '../src/providers';
describe('credential protection', () => {
  it('encrypts with unique randomness, unlocks correctly, and rejects wrong passphrases', async () => {
    const secret = await encrypt('sensitive-api-token', 'a long test passphrase');
    const second = await encrypt('sensitive-api-token', 'a long test passphrase');
    expect(secret.data).not.toContain('sensitive'); expect(secret.iv).not.toBe(second.iv);
    expect(await decrypt(secret, 'a long test passphrase')).toBe('sensitive-api-token');
    await expect(decrypt(secret, 'a different passphrase')).rejects.toThrow('Could not unlock');
    await expect(encrypt('token', 'short')).rejects.toThrow('12 characters');
  });
});
describe('device storage', () => {
  it('persists snapshots and independently deletes a provider with its credential', async () => {
    await save({ provider: 'vercel', scope: '', mode: 'session' }, 'connections');
    await save({ provider: 'neon', scope: '', mode: 'session' }, 'connections');
    await save({ provider: 'vercel', at: 123, resources: [], note: 'test' }, 'snapshots');
    expect((await all<Snapshot>('snapshots'))[0].at).toBe(123);
    await remove('vercel'); expect(await all('snapshots')).toEqual([]);
    expect((await all<Connection>('connections')).map(c => c.provider)).toEqual(['neon']);
    await remove('neon');
  });
});
describe('freshness', () => {
  const s: Snapshot = { provider: 'vercel', at: 1000, resources: [], note: '' };
  it('marks old, offline, or failed snapshots stale without changing their timestamp', () => {
    expect(stale(s, false, true, 2000)).toBe(false);
    expect(stale(s, false, true, 302000)).toBe(true);
    expect(stale(s, true, true, 2000)).toBe(true);
    expect(stale(s, false, false, 2000)).toBe(true);
    expect(s.at).toBe(1000);
  });
});
describe('provider boundary', () => {
  beforeEach(() => vi.unstubAllGlobals());
  it('uses only official GET requests, omits cookies, and encodes account scope', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ deployments: [{ uid: 'd1', name: 'site', state: 'READY', target: 'production' }] })));
    vi.stubGlobal('fetch', fetcher);
    const snapshot = await fetchSnapshot('vercel', 'private-token', 'team & x', new AbortController().signal);
    const [url, options] = fetcher.mock.calls[0];
    expect(url.origin).toBe('https://api.vercel.com'); expect(url.searchParams.get('teamId')).toBe('team & x');
    expect(options.method).toBe('GET'); expect(options.credentials).toBe('omit'); expect(options.cache).toBe('no-store');
    expect(JSON.stringify(snapshot)).not.toContain('private-token'); expect(snapshot.resources[0].status).toBe('READY');
  });
  it('does not replace malformed or denied responses with empty success data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    await expect(fetchSnapshot('neon', 'x', '', new AbortController().signal)).rejects.toThrow('resource list');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(fetchSnapshot('vercel', 'x', '', new AbortController().signal)).rejects.toThrow('rate limit');
  });
  it('reports a browser network error without claiming a confirmed CORS diagnosis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchSnapshot('cloudflare', 'x', '', new AbortController().signal)).rejects.toThrow('CORS, connectivity');
  });
});
