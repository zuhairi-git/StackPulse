export type Provider = 'vercel' | 'neon' | 'cloudflare';
export type Resource = { id: string; name: string; detail: string; status: string; url?: string };
export type Snapshot = { provider: Provider; at: number; resources: Resource[]; note: string };
export type Secret = { salt: string; iv: string; data: string };
export type Connection = { provider: Provider; scope: string; mode: 'session' | 'encrypted' | 'plain'; secret?: Secret; token?: string };
export const providers: Provider[] = ['vercel', 'neon', 'cloudflare'];
export const meta = {
  vercel: { name: 'Vercel', category: 'Deployments & hosting', description: 'Keep your latest deployments in sight.', dashboard: 'https://vercel.com/dashboard', docs: 'https://vercel.com/docs/rest-api/deployments/list-deployments', keys: 'https://vercel.com/account/settings/tokens', scope: 'Team ID (optional)', permission: 'Use a token scoped to the smallest team you need. Token privileges may include writes; StackPulse only issues GET requests.' },
  neon: { name: 'Neon', category: 'Serverless Postgres', description: 'A little clarity for your databases.', dashboard: 'https://console.neon.tech', docs: 'https://api-docs.neon.tech/reference/listprojects', keys: 'https://console.neon.tech', scope: 'Organization ID (for personal keys)', permission: 'Prefer a personal key from a Viewer account. Project-scoped keys have Editor privileges. StackPulse only issues GET requests.' },
  cloudflare: { name: 'Cloudflare', category: 'Domains & edge', description: 'Your domains, connected at the edge.', dashboard: 'https://dash.cloudflare.com', docs: 'https://developers.cloudflare.com/api/resources/zones/methods/list/', keys: 'https://dash.cloudflare.com/profile/api-tokens', scope: 'Account ID (optional)', permission: 'Create an API token with Zone → Zone → Read, restricted to the zones you want to monitor. Do not use a Global API Key.' },
};
export function stale(snapshot: Snapshot | undefined, failed: boolean, online: boolean, now = Date.now()) {
  return !!snapshot && (failed || !online || now - snapshot.at > 300_000);
}
