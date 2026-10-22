import { defaultWorkspaceId, type Connection, type Secret, type Snapshot, type Workspace } from './model';
import { api, cloudAccount, session } from './account';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(cloudAccount() ? 'stackpulse-account-' + session.user!.email : 'stackpulse', 3);
    request.onupgradeneeded = () => {
      for (const [name, keyPath] of [['connections', 'id'], ['snapshots', 'connectionId']]) {
        if (!request.result.objectStoreNames.contains(name)) { request.result.createObjectStore(name, { keyPath }); continue; }
        const existing = request.transaction!.objectStore(name);
        if (existing.keyPath === keyPath) {
          if (name === 'connections') {
            const cursor = existing.openCursor();
            cursor.onsuccess = () => { const row = cursor.result; if (row) { row.update({ ...row.value, workspaceId: row.value.workspaceId || defaultWorkspaceId }); row.continue(); } };
          }
          continue;
        }
        const old = existing.getAll();
        old.onsuccess = () => {
          request.result.deleteObjectStore(name);
          const store = request.result.createObjectStore(name, { keyPath });
          for (const record of old.result) store.put({ ...record, [keyPath]: `legacy:${record.provider}`, ...(name === 'connections' ? { workspaceId: defaultWorkspaceId } : {}) });
        };
      }
      if (!request.result.objectStoreNames.contains('workspaces')) {
        const store = request.result.createObjectStore('workspaces', { keyPath: 'id' });
        store.put({ id: defaultWorkspaceId, name: 'Personal', createdAt: Date.now() });
      }
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(new Error('Device storage is unavailable. Check browser storage permissions.'));
  });
}
export async function all<T>(store: 'connections' | 'snapshots' | 'workspaces'): Promise<T[]> {
  if (store === 'connections' && cloudAccount()) {
    const rows = await api<Connection[]>('connections');
    const db = await database();
    const assignments = await new Promise<Connection[]>((resolve, reject) => {
      const tx = db.transaction('connections'); const request = tx.objectStore('connections').getAll();
      tx.oncomplete = () => { db.close(); resolve(request.result); }; tx.onerror = () => { db.close(); reject(new Error('Could not read workspace assignments.')); };
    });
    return rows.map(row => ({ ...row, workspaceId: assignments.find(c => c.id === row.id)?.workspaceId || defaultWorkspaceId })) as T[];
  }
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store); const request = tx.objectStore(store).getAll();
    tx.oncomplete = () => { db.close(); resolve(request.result as T[]); };
    tx.onerror = () => { db.close(); reject(new Error('Could not read device storage.')); };
  });
}
export async function saveWorkspace(workspace: Workspace) {
  const name = workspace.name.trim();
  if (!name || name.length > 60) throw new Error('Use a workspace name between 1 and 60 characters.');
  const db = await database();
  return new Promise<Workspace>((resolve, reject) => {
    const tx = db.transaction('workspaces', 'readwrite');
    const store = tx.objectStore('workspaces');
    let error = 'Could not save workspace.';
    const request = store.getAll();
    request.onsuccess = () => {
      if (request.result.some((w: Workspace) => w.id !== workspace.id && w.name.toLowerCase() === name.toLowerCase())) { error = 'A workspace with this name already exists.'; tx.abort(); return; }
      store.put({ ...workspace, name });
    };
    tx.oncomplete = () => { db.close(); resolve({ ...workspace, name }); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error(error)); };
  });
}
export async function moveConnection(connectionId: string, workspaceId: string): Promise<Connection> {
  const cloudConnection = cloudAccount() ? (await api<Connection[]>('connections')).find(c => c.id === connectionId) : undefined;
  if (cloudAccount() && !cloudConnection) throw new Error('Connection no longer exists.');
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['connections', 'workspaces'], 'readwrite');
    let moved: Connection;
    const target = tx.objectStore('workspaces').get(workspaceId);
    target.onsuccess = () => {
      if (!target.result) { tx.abort(); return; }
      const request = tx.objectStore('connections').get(connectionId);
      request.onsuccess = () => {
        if (!request.result && !cloudConnection) { tx.abort(); return; }
        moved = { ...request.result, ...cloudConnection, workspaceId };
        tx.objectStore('connections').put(cloudAccount() ? { id: connectionId, workspaceId } : moved);
      };
    };
    tx.oncomplete = () => { db.close(); resolve(moved); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Could not move account. Check the account and workspace still exist.')); };
  });
}
export async function save(value: Connection | Snapshot, store: 'connections' | 'snapshots') {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(new Error('Could not save to device storage. Storage may be full.')); };
    tx.onabort = tx.onerror;
  });
}
export async function saveConnection(connection: Connection, resetSnapshot: boolean) {
  if (cloudAccount()) await api('connections', 'PUT', connection);
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['connections', 'snapshots'], 'readwrite');
    tx.objectStore('connections').put(cloudAccount() ? { id: connection.id, workspaceId: connection.workspaceId } : connection);
    if (resetSnapshot) tx.objectStore('snapshots').delete(connection.id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = tx.onabort = () => { db.close(); reject(new Error('Could not save connection.')); };
  });
}
export async function remove(connectionId: string) {
  if (cloudAccount()) await api('connections/' + encodeURIComponent(connectionId), 'DELETE');
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['connections', 'snapshots'], 'readwrite');
    tx.objectStore('connections').delete(connectionId); tx.objectStore('snapshots').delete(connectionId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(new Error('Could not remove connection.')); };
  });
}
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
async function key(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encrypt(token: string, passphrase: string): Promise<Secret> {
  if (passphrase.length < 12) throw new Error('Use a passphrase with at least 12 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(passphrase, salt), new TextEncoder().encode(token));
  return { salt: encode(salt), iv: encode(iv), data: encode(new Uint8Array(data)) };
}
export async function decrypt(secret: Secret, passphrase: string): Promise<string> {
  try {
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(secret.iv) }, await key(passphrase, decode(secret.salt)), decode(secret.data));
    return new TextDecoder().decode(data);
  } catch { throw new Error('Could not unlock. Check your passphrase; the stored credential may also be damaged.'); }
}
