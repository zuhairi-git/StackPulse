import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { appShell } from '../vite.config';

function worker(base = '/') {
  let source = '';
  const plugin = appShell();
  (plugin.configResolved as (config: { base: string }) => void)({ base });
  const generate = plugin.generateBundle as unknown as (this: { emitFile: (file: { source: string }) => void }, options: unknown, bundle: object) => void;
  generate.call({ emitFile: file => { source = file.source; } }, {}, { 'assets/app.js': { source: 'app' } });
  const listeners: Record<string, (event: unknown) => void> = {};
  const cachedResponse = { body: 'cached module' };
  const match = vi.fn((_request, options) => Promise.resolve(options?.ignoreVary ? cachedResponse : undefined));
  const network = vi.fn().mockRejectedValue(new Error('offline'));
  runInNewContext(source, { self: { location: { origin: 'https://stackpulse.test' }, addEventListener: (name: string, callback: (event: unknown) => void) => { listeners[name] = callback; } }, caches: { keys: async () => [source.match(/const PREFIX = "([^"]+)"/)![1] + 'test'], open: async () => ({ match }) }, fetch: network, URL, Promise });
  return { listeners, cachedResponse, network, match, source };
}
describe('production offline shell', () => {
  it('serves a precached module offline despite an Origin-varying response', async () => {
    const w = worker(); let response: Promise<unknown> | undefined;
    w.listeners.fetch({ request: { url: 'https://stackpulse.test/assets/app.js', method: 'GET', mode: 'cors', headers: new Headers() }, respondWith: (result: Promise<unknown>) => { response = result; } });
    expect(await response).toBe(w.cachedResponse); expect(w.network).not.toHaveBeenCalled();
  });
  it('does not intercept provider APIs or credential-bearing same-origin requests', () => {
    const w = worker(); const respondWith = vi.fn();
    w.listeners.fetch({ request: { url: 'https://api.vercel.com/v7/deployments', method: 'GET', headers: new Headers() }, respondWith });
    w.listeners.fetch({ request: { url: 'https://stackpulse.test/assets/app.js', method: 'GET', headers: new Headers({ Authorization: 'Bearer secret' }) }, respondWith });
    expect(respondWith).not.toHaveBeenCalled(); expect(w.match).not.toHaveBeenCalled();
  });
  it('scopes Pages assets, navigation, and cache identity to the repository base', async () => {
    const w = worker('/StackPulse/'); let response: Promise<unknown> | undefined;
    w.listeners.fetch({ request: { url: 'https://stackpulse.test/StackPulse/assets/app.js', method: 'GET', mode: 'cors', headers: new Headers() }, respondWith: (result: Promise<unknown>) => { response = result; } });
    expect(await response).toBe(w.cachedResponse);
    const respondWith = vi.fn();
    w.listeners.fetch({ request: { url: 'https://stackpulse.test/another-app/', method: 'GET', mode: 'navigate', headers: new Headers() }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(w.source).toContain('/StackPulse/index.html');
    expect(w.source.match(/const PREFIX = .*/)?.[0]).not.toBe(worker('/').source.match(/const PREFIX = .*/)?.[0]);
  });
});
