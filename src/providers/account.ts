import type { Provider } from '../model';
import { items, object, read, text } from './http';

// Name discovery is optional: restricted tokens can still refresh resources.
export async function accountName(provider: Provider, token: string, scope: string, signal: AbortSignal): Promise<string | undefined> {
  try {
    if (provider === 'vercel') {
      const url = new URL(scope ? `https://api.vercel.com/v2/teams/${encodeURIComponent(scope)}` : 'https://api.vercel.com/v2/user');
      const data = object(await read(url, token, signal));
      const account = scope ? data : object(data.user);
      return text(account.name, text(account.slug, text(account.username, ''))) || undefined;
    }
    if (provider === 'neon') {
      if (scope) {
        const data = object(await read(new URL(`https://console.neon.tech/api/v2/organizations/${encodeURIComponent(scope)}`), token, signal));
        return text(data.name, '') || undefined;
      }
      const data = object(await read(new URL('https://console.neon.tech/api/v2/users/me/organizations'), token, signal));
      const organizations = items(data.organizations);
      return organizations.length === 1 ? text(organizations[0].name, '') || undefined : organizations.length > 1 ? 'Multiple organizations' : undefined;
    }
  } catch { /* A missing permission or browser restriction must not hide inventory. */ }
  return undefined;
}
