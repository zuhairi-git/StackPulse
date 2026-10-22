import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { all, moveConnection, save, saveConnection, saveWorkspace } from '../src/storage';
import { defaultWorkspaceId, type Connection, type Snapshot, type Workspace } from '../src/model';
import { loadWorkspaceSelection, workspaceConnections, workspaceSelectionKey, workspaceSnapshots } from '../src/workspaces';

beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

describe('workspaces', () => {
  it('creates a default workspace and persists trimmed, uniquely named workspaces and renames', async () => {
    expect((await all<Workspace>('workspaces'))[0]).toMatchObject({ id: defaultWorkspaceId, name: 'Personal' });
    await saveWorkspace({ id: 'client', name: ' Client projects ', createdAt: 100 });
    expect((await all<Workspace>('workspaces')).find(w => w.id === 'client')?.name).toBe('Client projects');
    await expect(saveWorkspace({ id: 'duplicate', name: 'client PROJECTS', createdAt: 101 })).rejects.toThrow('already exists');
    await expect(saveWorkspace({ id: 'empty', name: ' ', createdAt: 102 })).rejects.toThrow('1 and 60');
    await saveWorkspace({ id: 'client', name: 'Acme', createdAt: 100 });
    expect((await all<Workspace>('workspaces')).find(w => w.id === 'client')).toMatchObject({ name: 'Acme', createdAt: 100 });
  });
  it('moves an account without changing its ID, saved credentials or cached resources', async () => {
    await saveWorkspace({ id: 'client', name: 'Client', createdAt: 100 });
    const connection: Connection = { id: 'account', workspaceId: defaultWorkspaceId, provider: 'neon', scope: 'org-work', mode: 'encrypted', secret: { data: 'encrypted-token', salt: 'salt', iv: 'iv' } };
    const snapshot: Snapshot = { connectionId: connection.id, provider: 'neon', accountName: 'Work', at: 123, resources: [{ id: 'p1', name: 'Project', detail: 'region', status: 'Listed' }], note: 'cached' };
    await saveConnection(connection, true); await save(snapshot, 'snapshots');
    const moved = await moveConnection(connection.id, 'client');
    expect(moved).toEqual({ ...connection, workspaceId: 'client' });
    const savedConnections = await all<Connection>('connections');
    const savedSnapshots = await all<Snapshot>('snapshots');
    expect(workspaceConnections(savedConnections, defaultWorkspaceId)).toEqual([]);
    expect(workspaceSnapshots(savedSnapshots, workspaceConnections(savedConnections, defaultWorkspaceId))).toEqual([]);
    expect(workspaceSnapshots(savedSnapshots, workspaceConnections(savedConnections, 'client'))).toEqual([snapshot]);
    await expect(moveConnection(connection.id, 'missing')).rejects.toThrow('Could not move');
    await expect(moveConnection('missing', 'client')).rejects.toThrow('Could not move');
    expect(await all<Connection>('connections')).toEqual([moved]);
  });
  it('keeps accounts from the same provider in separate workspace selections', () => {
    const connections: Connection[] = [
      { id: 'personal', workspaceId: 'personal', provider: 'vercel', scope: '', mode: 'session' },
      { id: 'client', workspaceId: 'client', provider: 'vercel', scope: '', mode: 'session' },
    ];
    expect(workspaceConnections(connections, 'personal').map(c => c.id)).toEqual(['personal']);
    expect(workspaceConnections(connections, 'client').map(c => c.id)).toEqual(['client']);
    expect(workspaceConnections(connections, 'empty')).toEqual([]);
  });
  it('restores the selected workspace and handles unavailable browser storage', () => {
    const getItem = vi.fn(() => 'client'); vi.stubGlobal('localStorage', { getItem });
    expect(loadWorkspaceSelection()).toBe('client'); expect(getItem).toHaveBeenCalledWith(workspaceSelectionKey);
    getItem.mockImplementation(() => { throw new Error('Blocked'); });
    expect(loadWorkspaceSelection()).toBe(defaultWorkspaceId);
  });
  it('migrates v2 accounts into Personal while retaining connection IDs, tokens, names, and timestamps', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('stackpulse', 2);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('connections', { keyPath: 'id' }).put({ id: 'existing', provider: 'vercel', scope: 'team_work', mode: 'plain', token: 'existing-token' });
        request.result.createObjectStore('snapshots', { keyPath: 'connectionId' }).put({ connectionId: 'existing', provider: 'vercel', accountName: 'Work', at: 123, resources: [], note: 'cached' });
      };
      request.onsuccess = () => { request.result.close(); resolve(); }; request.onerror = () => reject(request.error);
    });
    expect((await all<Connection>('connections'))[0]).toMatchObject({ id: 'existing', workspaceId: defaultWorkspaceId, token: 'existing-token' });
    expect((await all<Snapshot>('snapshots'))[0]).toMatchObject({ connectionId: 'existing', accountName: 'Work', at: 123 });
    expect((await all<Workspace>('workspaces'))[0].id).toBe(defaultWorkspaceId);
  });
});
