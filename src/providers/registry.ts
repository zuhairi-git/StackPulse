import type { Resource } from '../model';
import { vercel } from './vercel';
import { neon } from './neon';
import { cloudflare } from './cloudflare';
import { accountName } from './account';

export type ProviderDefinition = {
  name: string; category: string; description: string;
  dashboard: string; docs: string; keys: string;
  scope: string; scopePlaceholder: string; scopeHelp: string; permission: string;
  resourceLabel: string; probeURL: string; requiresBrowserCheck: boolean; defaultEnabled: boolean;
  fetch: (token: string, scope: string, signal: AbortSignal) => Promise<{ resources: Resource[]; note: string; accountName?: string }>;
  discoverName?: (token: string, scope: string, signal: AbortSignal) => Promise<string | undefined>;
};

// Register reviewed adapters here; Settings and connection forms use this catalog automatically.
export const providerRegistry = {
  vercel: { fetch: vercel, discoverName: (token, scope, signal) => accountName('vercel', token, scope, signal), probeURL: 'https://api.vercel.com/v7/deployments?limit=1', requiresBrowserCheck: false, defaultEnabled: true, resourceLabel: 'recent deployments', name: 'Vercel', category: 'Deployments & hosting', description: 'Keep your latest deployments in sight.', dashboard: 'https://vercel.com/dashboard', docs: 'https://vercel.com/docs/rest-api/deployments/list-deployments', keys: 'https://vercel.com/account/settings/tokens', scope: 'Team / Organization ID (optional)', scopePlaceholder: 'team_…', scopeHelp: 'Use your Vercel Team ID from team settings. For a team-linked project, this is also called orgId in .vercel/project.json or VERCEL_ORG_ID in CI.', permission: 'Use a token scoped to the smallest team you need. Token privileges may include writes; StackPulse only issues GET requests.' },
  neon: { fetch: neon, discoverName: (token, scope, signal) => accountName('neon', token, scope, signal), probeURL: 'https://console.neon.tech/api/v2/projects?limit=1', requiresBrowserCheck: true, defaultEnabled: true, resourceLabel: 'listed projects', name: 'Neon', category: 'Serverless Postgres', description: 'A little clarity for your databases.', dashboard: 'https://console.neon.tech', docs: 'https://api-docs.neon.tech/reference/listprojects', keys: 'https://console.neon.tech', scope: 'Organization ID', scopePlaceholder: 'org-…', scopeHelp: 'With a personal API key, enter the organization ID to select its projects. Organization API keys infer the organization automatically; you can leave this blank.', permission: 'Prefer a personal key from a Viewer account. Project-scoped keys have Editor privileges. StackPulse only issues GET requests.' },
  cloudflare: { fetch: cloudflare, probeURL: 'https://api.cloudflare.com/client/v4/zones?per_page=1', requiresBrowserCheck: true, defaultEnabled: true, resourceLabel: 'listed zones', name: 'Cloudflare', category: 'Domains & edge', description: 'Your domains, connected at the edge.', dashboard: 'https://dash.cloudflare.com', docs: 'https://developers.cloudflare.com/api/resources/zones/methods/list/', keys: 'https://dash.cloudflare.com/profile/api-tokens', scope: 'Account ID (optional)', scopePlaceholder: 'Cloudflare Account ID', scopeHelp: 'Use your Cloudflare Account ID to filter zones to one account. Leave blank to list zones accessible to this token. A Zone ID is a different identifier.', permission: 'Create an API token with Zone → Zone → Read, restricted to the zones you want to monitor. Do not use a Global API Key.' },
} satisfies Record<string, ProviderDefinition>;
