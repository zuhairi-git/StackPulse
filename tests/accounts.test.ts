import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSnapshot } from '../src/providers';

afterEach(() => vi.unstubAllGlobals());
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe('account discovery', () => {
  it('fetches the scoped Vercel team name and keeps same-provider snapshots separate', async () => {
    const fetcher = vi.fn(async (url: URL) => response(url.pathname.includes('/teams/') ? { name: url.pathname.endsWith('team_work') ? 'Work team' : 'Personal team' } : { deployments: [{ uid: 'same-id', name: 'app', state: 'READY' }] }));
    vi.stubGlobal('fetch', fetcher);
    const [work, personal] = await Promise.all([
      fetchSnapshot('vercel', 'work-secret', 'team_work', new AbortController().signal, 'work'),
      fetchSnapshot('vercel', 'personal-secret', 'team_personal', new AbortController().signal, 'personal'),
    ]);
    expect(work.connectionId).toBe('work'); expect(personal.connectionId).toBe('personal');
    expect(work.accountName).toBe('Work team'); expect(personal.accountName).toBe('Personal team');
    for (const [url, options] of fetcher.mock.calls as unknown as [URL, RequestInit][]) {
      expect(url.origin).toBe('https://api.vercel.com'); expect(options.method).toBe('GET');
      const token = url.toString().includes('team_work') ? 'work-secret' : 'personal-secret';
      expect(options.headers).toMatchObject({ Authorization: `Bearer ${token}` });
    }
    expect(JSON.stringify([work, personal])).not.toContain('secret');
  });
  it('uses Vercel user identity only when no team was selected', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => response(url.pathname === '/v2/user' ? { user: { name: null, username: 'personal-user' } } : { deployments: [] })));
    expect((await fetchSnapshot('vercel', 'x', '', new AbortController().signal)).accountName).toBe('personal-user');
  });
  it('reads Neon organization names from the documented top-level response', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => response(url.pathname.includes('/organizations/') ? { id: 'org-work', name: 'Work organization' } : { projects: [] })));
    expect((await fetchSnapshot('neon', 'x', 'org-work', new AbortController().signal)).accountName).toBe('Work organization');
  });
  it('discovers a Neon organization-key name without a manually supplied ID', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => response(url.pathname.endsWith('/users/me/organizations') ? { organizations: [{ id: 'org-work', name: 'Work organization' }] } : { projects: [] })));
    expect((await fetchSnapshot('neon', 'x', '', new AbortController().signal)).accountName).toBe('Work organization');
  });
  it.each([403, 429, 500])('preserves a successful inventory if name lookup returns HTTP %s', async status => {
    vi.stubGlobal('fetch', vi.fn(async (url: URL) => url.pathname.includes('/teams/') ? response({}, status) : response({ deployments: [{ uid: 'd1', name: 'app', state: 'READY' }] })));
    const snapshot = await fetchSnapshot('vercel', 'x', 'team_work', new AbortController().signal);
    expect(snapshot.resources).toHaveLength(1); expect(snapshot.accountName).toBeUndefined();
  });
  it('reads scoped Cloudflare account names from zones without another API request', async () => {
    const fetcher = vi.fn(async () => response({ success: true, result: [{ id: 'z1', name: 'example.com', account: { id: 'work', name: 'Work account' } }] }));
    vi.stubGlobal('fetch', fetcher);
    const snapshot = await fetchSnapshot('cloudflare', 'x', 'work', new AbortController().signal);
    expect(snapshot.accountName).toBe('Work account'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not mislabel a connection covering multiple Cloudflare accounts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ success: true, result: [
      { id: 'z1', account: { id: 'a', name: 'A' } }, { id: 'z2', account: { id: 'b', name: 'B' } },
    ] })));
    expect((await fetchSnapshot('cloudflare', 'x', '', new AbortController().signal)).accountName).toBe('Multiple accounts');
  });
});
