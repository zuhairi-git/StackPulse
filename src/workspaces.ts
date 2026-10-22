import { defaultWorkspaceId, type Connection, type Snapshot } from './model';

export const workspaceSelectionKey = 'stackpulse-workspace';
export function loadWorkspaceSelection(): string {
  try { return localStorage.getItem(workspaceSelectionKey) || defaultWorkspaceId; } catch { return defaultWorkspaceId; }
}
export function workspaceConnections(connections: Connection[], workspaceId: string): Connection[] {
  return connections.filter(c => c.workspaceId === workspaceId);
}
export function workspaceSnapshots(snapshots: Snapshot[], connections: Connection[]): Snapshot[] {
  const ids = new Set(connections.map(c => c.id));
  return snapshots.filter(s => ids.has(s.connectionId));
}
