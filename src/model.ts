import { providerRegistry } from './providers/registry';
export type Provider = keyof typeof providerRegistry;
export type Resource = { id: string; name: string; detail: string; status: string; url?: string };
export type Snapshot = { connectionId: string; provider: Provider; accountName?: string; at: number; resources: Resource[]; note: string };
export type Secret = { salt: string; iv: string; data: string };
export type Connection = { id: string; label?: string; provider: Provider; scope: string; mode: 'session' | 'encrypted' | 'plain'; secret?: Secret; token?: string };
export const providers = Object.keys(providerRegistry) as Provider[];
export const meta = providerRegistry;
export function stale(snapshot: Snapshot | undefined, failed: boolean, online: boolean, now = Date.now()) {
  return !!snapshot && (failed || !online || now - snapshot.at > 300_000);
}
