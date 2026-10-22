import { useState, useEffect } from 'react';

export type Session = { available: boolean; enabled: boolean; user: null | { email: string; active: boolean; owner: boolean; canClaim: boolean } };
export let session: Session = { available: false, enabled: false, user: null };
export async function api<T>(path: string, method = 'GET', value?: unknown): Promise<T> {
  const response = await fetch('/api/' + path, { method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000), headers: value === undefined ? {} : { 'Content-Type': 'application/json' }, body: value === undefined ? undefined : JSON.stringify(value) });
  if (!response.ok) throw new Error('Account request failed. Check your connection and account activation.');
  return response.json();
}
export async function loadSession() {
  try { session = await api<Session>('session'); } catch { /* Static hosting continues to support guest use. */ }
}
export const cloudAccount = () => !!session.user?.active;

export function AccountPanel() {
  const [open, setOpen] = useState(false), [error, setError] = useState(''), [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState<{ enabled: boolean; users: { sub: string; email: string; active: number }[] }>();
  const [guest, setGuest] = useState(false);
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); } finally { setBusy(false); } };
  useEffect(() => { if (open && session.user?.owner) void run(async () => setAdmin(await api('admin'))); }, [open]);
  const logout = async () => { await api('auth/logout', 'POST'); location.reload(); };
  return <div className="account-control"><button className="button secondary" onClick={() => setOpen(!open)}>{session.user?.email || 'Sign in / Guest'}</button>{open && <section className="account-panel panel" aria-label="Sign-in control panel">
    <h2>{session.user ? 'Your account' : 'Use StackPulse your way'}</h2>
    <p>Guest mode stays on this device. Activated Google accounts save connection fields only. Snapshots and resource data stay on the device.</p>
    {!session.user ? <>{session.available ? <><a className="button primary" href="/api/auth/start">Sign in with Google</a><p>{session.enabled ? 'New accounts require owner activation.' : 'Account sync is disabled. The owner can sign in to enable it.'}</p></> : <p>Google sign-in needs server configuration. Guest mode is available.</p>}<button className="button secondary" onClick={() => { setGuest(true); setOpen(false); }}>Continue as guest</button>{guest && <small>Guest mode</small>}</> : <>
      <p>{session.user.active ? 'Connection settings sync to your account. Memory-only tokens are never synced. Workspace organization stays on this device.' : 'Your account is awaiting activation. You can sign out and continue as guest.'}</p>
      {session.user.canClaim && <form onSubmit={e => { e.preventDefault(); void run(async () => { await api('admin/claim', 'POST', { code }); location.reload(); }); }}><label>Owner setup code<input type="password" value={code} onChange={e => setCode(e.target.value)} required autoComplete="off"/></label><button className="button primary" disabled={busy}>Activate owner control panel</button></form>}
      {admin && <><h3>Owner · Sign-in controls</h3><button className="button secondary" disabled={busy} onClick={() => void run(async () => { await api('admin', 'PUT', { enabled: !admin.enabled }); setAdmin(await api('admin')); })}>{admin.enabled ? 'Disable account sync' : 'Enable account sync'}</button><p>Approve accounts below. Disabling sync blocks server reads and writes; guest use remains available.</p>{admin.users.map(user => <div className="setting-row" key={user.sub}><span>{user.email}</span>{user.email === session.user?.email ? <small>Owner</small> : <button className="button secondary" disabled={busy} onClick={() => void run(async () => { await api('admin', 'PUT', { sub: user.sub, active: !user.active }); setAdmin(await api('admin')); })}>{user.active ? 'Deactivate' : 'Activate'}</button>}</div>)}{admin.users.length > 200 && <p>Showing the first 201 accounts.</p>}</>}
      <button className="button secondary" disabled={busy} onClick={() => void run(logout)}>Sign out · use as guest</button>
    </>}{error && <p role="alert" className="error">{error}</p>}<button className="text-button" onClick={() => setOpen(false)}>Close</button>
  </section>}</div>;
}
