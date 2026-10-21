import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { meta, providers, stale, type Connection, type Provider, type Snapshot } from './model';
import { all, save, remove, encrypt, decrypt } from './storage';
import { checkBrowser, fetchSnapshot } from './providers';

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    pulse: <path d="M2 12h5l3-8 4 16 3-8h5"/>,
    link: <><path d="m9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/></>,
    settings: <><circle cx="12" cy="12" r="4"/><path d="m9 3-1 3-3 1-2 3 2 2-1 4 3 2 3-1 2 4 4-1 1-3 4-2-1-4-3-1-1-4Z"/></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    external: <><path d="M14 3h7v7m0-7-11 11M10 3H4v17h17v-6"/></>,
    refresh: <><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    box: <><path d="m12 3 9 5-9 5-9-5Zm-9 5v10l9 4 9-4V8M12 13v9"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.box}</svg>;
}
function Logo({ provider }: { provider: Provider }) {
  return <span className={`provider-logo ${provider}`} aria-hidden="true">{provider === 'vercel' ? <svg viewBox="0 0 32 32"><path fill="currentColor" d="M16 5 30 28H2Z"/></svg> : provider === 'neon' ? <svg viewBox="0 0 32 32"><path d="M7 26V6h19v20H16V14l10 12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round"/></svg> : <svg viewBox="0 0 40 32"><path fill="currentColor" d="M7 25a6 6 0 0 1-1-12 10 10 0 0 1 19-2 7 7 0 0 1 8 7h1a4 4 0 0 1 0 8H7Z"/></svg>}</span>;
}
const ago = (at?: number) => !at ? 'Never synced' : Date.now() - at < 60_000 ? 'Just now' : `${Math.floor((Date.now() - at) / 60_000)}m ago`;
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function App() {
  const [page, setPage] = useState('Overview');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [errors, setErrors] = useState<Partial<Record<Provider, string>>>({});
  const [busy, setBusy] = useState<Partial<Record<Provider, boolean>>>({});
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<Provider>();
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const [install, setInstall] = useState<InstallEvent>();
  const [interval, setIntervalSeconds] = useState(0);
  const [, tick] = useState(0);
  const tokens = useRef<Partial<Record<Provider, string>>>({});
  const requests = useRef<Partial<Record<Provider, AbortController>>>({});
  const [unlocked, setUnlocked] = useState<Provider[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all([all<Connection>('connections'), all<Snapshot>('snapshots')]).then(([c, s]) => { if (active) { setConnections(c); setSnapshots(s); setReady(true); } }).catch(e => { if (active) setNotice(message(e)); });
    const net = () => setOnline(navigator.onLine);
    const prompt = (e: Event) => { e.preventDefault(); setInstall(e as InstallEvent); };
    const offlineFailed = () => setNotice('Offline shell could not be installed. Check browser storage permissions.');
    window.addEventListener('online', net); window.addEventListener('offline', net); window.addEventListener('beforeinstallprompt', prompt); window.addEventListener('stackpulse-offline-unavailable', offlineFailed);
    const timer = window.setInterval(() => tick(n => n + 1), 15000);
    return () => { active = false; clearInterval(timer); window.removeEventListener('online', net); window.removeEventListener('offline', net); window.removeEventListener('beforeinstallprompt', prompt); window.removeEventListener('stackpulse-offline-unavailable', offlineFailed); };
  }, []);
  async function refresh(connection: Connection, supplied?: string) {
    const p = connection.provider; const token = supplied || tokens.current[p] || connection.token;
    if (!token || !navigator.onLine || requests.current[p]) return;
    const controller = new AbortController(); requests.current[p] = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000); setBusy(b => ({ ...b, [p]: true }));
    try {
      const snapshot = await fetchSnapshot(p, token, connection.scope, controller.signal);
      if (controller.signal.aborted) return;
      await save(snapshot, 'snapshots');
      if (!controller.signal.aborted) { setSnapshots(s => [...s.filter(x => x.provider !== p), snapshot]); setErrors(e => ({ ...e, [p]: undefined })); }
    } catch (e) { if (!controller.signal.aborted || tokens.current[p]) setErrors(old => ({ ...old, [p]: message(e) })); }
    finally { clearTimeout(timeout); if (requests.current[p] === controller) { delete requests.current[p]; setBusy(b => ({ ...b, [p]: false })); } }
  }
  const refreshAll = () => connections.forEach(c => void refresh(c));
  useEffect(() => {
    if (!interval) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) refreshAll(); }, interval * 1000);
    return () => clearInterval(timer);
  }, [interval, connections]);
  function lock() { Object.values(requests.current).forEach(c => c?.abort()); tokens.current = {}; setUnlocked([]); setNotice('Session credentials cleared. Encrypted credentials are locked. Unencrypted saved tokens remain accessible to this browser.'); }
  async function connect(connection: Connection, token: string) {
    if (requests.current[connection.provider]) throw new Error('A refresh is in progress. Wait for it to finish before changing credentials.');
    await save(connection, 'connections'); tokens.current[connection.provider] = token;
    setUnlocked(u => [...u.filter(p => p !== connection.provider), connection.provider]);
    setConnections(c => [...c.filter(x => x.provider !== connection.provider), connection]); setModal(undefined);
    await refresh(connection, token);
  }
  async function disconnect(p: Provider) {
    requests.current[p]?.abort(); await remove(p); delete tokens.current[p];
    setUnlocked(u => u.filter(x => x !== p)); setConnections(c => c.filter(x => x.provider !== p)); setSnapshots(s => s.filter(x => x.provider !== p)); setErrors(e => ({ ...e, [p]: undefined })); setModal(undefined);
  }
  const resources = snapshots.flatMap(s => s.resources.map(r => ({ ...r, provider: s.provider, at: s.at })));
  const visible = resources.filter(r => (filter === 'all' || r.provider === filter) && `${r.name} ${r.detail} ${r.status}`.toLowerCase().includes(query.toLowerCase()));
  const latest = snapshots.length ? Math.max(...snapshots.map(s => s.at)) : undefined;
  const attention = providers.filter(p => errors[p] || stale(snapshots.find(s => s.provider === p), false, online)).length;
  const accessible = connections.filter(c => unlocked.includes(c.provider) || c.token).length;
  return <div className="app">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('Overview'); }}><img src={`${import.meta.env.BASE_URL}icon.svg`} alt=""/><span>StackPulse<span className="brand-dot">.</span></span></a>
      <div className="workspace"><span className="workspace-avatar">S</span><div>Personal workspace<small>Local to this device</small></div><Icon name="lock" size={14}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{[['Overview', 'grid'], ['Connections', 'link'], ['Settings', 'settings']].map(([label, icon]) => <button key={label} className={page === label ? 'nav-item active' : 'nav-item'} onClick={() => setPage(label)}><Icon name={icon}/>{label}{label === 'Connections' && <span className="nav-count">{connections.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="private-card"><Icon name="shield"/><strong>Yours. By design.</strong><p>Your credentials stay on your device. Your infrastructure stays yours.</p><button className="text-button" onClick={() => setPage('Settings')}>Privacy & storage <Icon name="arrow" size={15}/></button></div><button className="install-button" onClick={async () => { if (install) { await install.prompt(); await install.userChoice; setInstall(undefined); } else setNotice('To install StackPulse, use your browser’s Install app menu. On iOS: Share → Add to Home Screen. Installation requires HTTPS or localhost.'); }}><Icon name="download" size={17}/> Install StackPulse</button><div className="version"><span className="dot green"/>Local-first <span>v0.1.0</span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><span className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></span><div><span className={`network ${online ? '' : 'amber'}`}><span className={`dot ${online ? 'green' : 'amber'}`}/>{online ? 'Device online' : 'Offline · cached data'}</span><span className="avatar">S</span></div></header>
    <main>
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}><Icon name="close" size={16}/></button></div>}
      <div className="page-heading"><div><div className="eyebrow">YOUR STACK, AT A GLANCE</div><h1>{page}</h1><p>{page === 'Overview' ? 'Your infrastructure. One pulse.' : page === 'Connections' ? 'Three providers. One place to check in.' : 'A small app. Entirely on your terms.'}</p></div><button className="button secondary" disabled={!accessible || Object.values(busy).some(Boolean) || !online} onClick={refreshAll}><Icon name="refresh" size={16}/>Refresh all</button></div>
      {page === 'Settings' ? <div className="settings-layout"><section className="panel"><h2>Device & privacy</h2><p>StackPulse has no application backend, analytics, or credential sync.</p><div className="setting-row"><div><strong>Automatic refresh</strong><small>Only while this tab is visible and credentials are available.</small></div><select aria-label="Automatic refresh" value={interval} onChange={e => setIntervalSeconds(Number(e.target.value))}><option value="0">Manual only</option><option value="60">Every minute</option><option value="300">Every 5 minutes</option></select></div><div className="setting-row"><div><strong>Clear session credentials</strong><small>Also locks passphrase-protected connections.</small></div><button className="button secondary" onClick={lock}><Icon name="lock" size={16}/>Lock session</button></div><div className="setting-row"><div><strong>Cached account data</strong><small>Resource names and status snapshots are stored unencrypted in IndexedDB. Disconnect a provider to erase its data.</small></div><button className="text-button" onClick={() => setPage('Connections')}>Manage <Icon name="arrow" size={16}/></button></div></section><section className="panel"><h2>Built to stay small</h2><p>React, TypeScript, and native browser APIs. No provider SDKs. No trackers. No background polling when the app is closed.</p><div className="info-box"><Icon name="shield"/><div><strong>Credential protection</strong><p>Choose memory-only, passphrase encryption, or unencrypted device storage per connection. Encryption uses AES-256-GCM and PBKDF2. Your passphrase is never saved. Encryption protects stored tokens, not an unlocked tab or compromised device.</p></div></div><p className="fine-print">Preferences reset when this app reloads. Offline installation is available in the production build.</p></section></div> : <>
      {page === 'Overview' && <><section className="hero"><div className="hero-copy"><span className="hero-label"><span className={`dot ${attention ? 'amber' : 'blue'}`}/>{connections.length ? attention ? 'YOUR STACK NEEDS A CHECK-IN' : 'YOUR WORKSPACE IS CONNECTED' : 'A LITTLE LESS TAB SWITCHING'}</span><h2>{connections.length ? 'Your stack. In perspective.' : 'Meet your new control room.'}</h2><p>{connections.length ? 'Independent connections. Clear snapshots. Everything in one quiet place.' : 'Connect your providers and bring your infrastructure into focus. Private, lightweight, and always close by.'}</p><button className="button primary" onClick={() => setModal(providers.find(p => !connections.some(c => c.provider === p)) || 'vercel')}><Icon name="plus" size={17}/>{connections.length ? 'Manage a connection' : 'Connect your first provider'}<Icon name="arrow" size={17}/></button></div><div className="topology" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><svg className="wires" viewBox="0 0 360 230"><path d="M180 115 80 55M180 115l110-40M180 115l35 90"/></svg><div className="node center"><Icon name="pulse" size={38}/></div><div className="node node-vercel"><Logo provider="vercel"/></div><div className="node node-neon"><Logo provider="neon"/></div><div className="node node-cloudflare"><Logo provider="cloudflare"/></div><span className="topology-caption">ONE CONNECTED VIEW</span></div></section>
      <div className="metrics">{[["Connected providers", `${connections.length}`, '/ 3', 'link'], ['Visible resources', snapshots.length ? `${resources.length}` : '—', 'latest snapshots', 'box'], ['Needs attention', connections.length ? `${attention}` : '—', 'errors or stale data', 'pulse'], ['Last successful sync', ago(latest), latest ? new Date(latest).toLocaleTimeString() : 'waiting for a connection', 'clock']].map(([label, value, sub, icon]) => <div className="metric" key={label}><div>{label}<Icon name={icon} size={16}/></div><strong>{value}<small>{label === 'Connected providers' ? sub : ''}</small></strong><span>{label !== 'Connected providers' ? sub : 'Independent connections'}</span></div>)}</div></>}
      <section className="providers-section"><div className="section-heading"><h2>Your providers <span>03</span></h2><span className="subtle">Direct APIs. Device-local credentials.</span></div><div className="provider-grid">{providers.map(p => { const c = connections.find(c => c.provider === p); const s = snapshots.find(s => s.provider === p); const isStale = stale(s, !!errors[p], online); const available = unlocked.includes(p) || !!c?.token; return <article className="provider-card" key={p}><div className="provider-card-top"><Logo provider={p}/><span className={`badge ${errors[p] || isStale ? 'amber' : c && available ? 'green' : ''}`}><span className={`dot ${errors[p] || isStale ? 'amber' : c && available ? 'green' : ''}`}/>{busy[p] ? 'Refreshing' : errors[p] ? 'Check connection' : isStale ? 'Stale data' : c ? available ? 'Connected' : 'Locked' : 'Not connected'}</span></div><h3>{meta[p].name}</h3><span className="provider-category">{meta[p].category}</span><div className="provider-body">{s ? <><strong className="resource-count">{s.resources.length}<span> {p === 'vercel' ? 'recent deployments' : p === 'neon' ? 'listed projects' : 'listed zones'}</span></strong><p className="fine-print">{s.note}</p></> : <><p>{meta[p].description}</p><div className="placeholder-line"/><div className="placeholder-line short"/></>}{errors[p] && <p className="error" role="status">{errors[p]}</p>}{!c && p !== 'vercel' && <span className="browser-note">Browser access may be restricted</span>}</div><div className="provider-card-footer"><span title={s ? new Date(s.at).toLocaleString() : undefined}><Icon name="clock" size={13}/>{s ? `${isStale ? 'Stale · ' : 'Snapshot · '}${ago(s.at)}` : 'No data yet'}</span><button className={c ? 'text-button' : 'connect-button'} disabled={!ready} onClick={() => setModal(p)}>{c ? available ? 'Manage' : 'Unlock' : 'Connect'}<Icon name={c ? 'arrow' : 'plus'} size={14}/></button></div></article>; })}</div></section>
      {page === 'Overview' ? <section className="resources panel"><div className="section-heading"><h2>Resource snapshots <span>{resources.length}</span></h2><label className="search"><Icon name="search" size={16}/><input aria-label="Search resources" placeholder="Search resources…" value={query} onChange={e => setQuery(e.target.value)}/></label></div><div className="tabs" role="group" aria-label="Filter resources">{['all', ...providers].map(p => <button className={filter === p ? 'selected' : ''} onClick={() => setFilter(p)} key={p}>{p === 'all' ? 'All providers' : meta[p as Provider].name}</button>)}</div>{visible.length ? <div className="table-wrap"><table><thead><tr><th>Resource</th><th>Provider</th><th>Reported state</th><th>Freshness</th><th><span className="sr-only">Dashboard</span></th></tr></thead><tbody>{visible.map(r => <tr key={r.provider + r.id}><td><strong>{r.name}</strong><small>{r.detail}</small></td><td>{meta[r.provider].name}</td><td><span className="badge">{r.status}</span></td><td><span className={stale(snapshots.find(s => s.provider === r.provider), !!errors[r.provider], online) ? 'amber' : 'subtle'}>{stale(snapshots.find(s => s.provider === r.provider), !!errors[r.provider], online) ? 'Stale · ' : ''}{ago(r.at)}</span></td><td><a href={meta[r.provider].dashboard} target="_blank" rel="noreferrer" aria-label={`Open ${r.name} provider dashboard`}><Icon name="external" size={16}/></a></td></tr>)}</tbody></table></div> : <div className="empty"><span className="empty-icon"><Icon name={resources.length ? 'search' : 'box'} size={25}/></span><h3>{resources.length ? 'No matching resources' : 'Your stack starts here'}</h3><p>{resources.length ? 'Try a different search or provider filter.' : 'Connect a provider to see real resources and their latest reported state.'}</p>{!resources.length && <button className="text-button" onClick={() => setModal('vercel')}>Add a connection <Icon name="arrow" size={16}/></button>}</div>}</section> : <section className="panel browser-info"><Icon name="shield"/><div><h2>Browser security is part of the picture.</h2><p>Vercel allowed the tested browser requests. Neon and Cloudflare did not allow the tested localhost preflights on October 21, 2026. You can recheck access from this browser before entering a token. Availability can change by endpoint or origin; a network failure alone cannot prove CORS is the cause.</p><p>StackPulse never routes credentials through a third-party proxy. Each provider works independently.</p></div></section>}
      <footer><span><Icon name="shield" size={15}/>Local-first by design</span><span>No analytics<span className="footer-dot">·</span>Read-only requests<span className="footer-dot">·</span>Built for your peace of mind</span><span>StackPulse <span className="blue">↗</span></span></footer>
      </>}
    </main></div>
    {modal && <ConnectionDialog key={modal} provider={modal} connection={connections.find(c => c.provider === modal)} onClose={() => setModal(undefined)} onConnect={connect} onDisconnect={disconnect} onRefresh={async () => { const c = connections.find(c => c.provider === modal); if (c) await refresh(c); setModal(undefined); }}/ >}
  </div>;
}

function ConnectionDialog({ provider, connection, onClose, onConnect, onDisconnect, onRefresh }: { provider: Provider; connection?: Connection; onClose: () => void; onConnect: (c: Connection, token: string) => Promise<void>; onDisconnect: (p: Provider) => Promise<void>; onRefresh: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [token, setToken] = useState(''); const [scope, setScope] = useState(connection?.scope || '');
  const [mode, setMode] = useState<Connection['mode']>('session'); const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState(''); const [working, setWorking] = useState(false); const [capability, setCapability] = useState(provider === 'vercel');
  const [checked, setChecked] = useState(false); const [deleting, setDeleting] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); setWorking(true); setError('');
    try {
      if (connection?.mode === 'encrypted' && !token) { await onConnect(connection, await decrypt(connection.secret!, passphrase)); return; }
      if (!capability) throw new Error('Check browser access before saving credentials.');
      const clean = token.trim(); if (!clean || /\s/.test(clean)) throw new Error('Enter a valid API token without whitespace.');
      const c: Connection = { provider, scope: scope.trim(), mode };
      if (mode === 'encrypted') c.secret = await encrypt(clean, passphrase); else if (mode === 'plain') c.token = clean;
      await onConnect(c, clean);
    } catch (e) { setError(message(e)); } finally { setWorking(false); }
  }
  return <dialog ref={dialog} aria-labelledby="connection-title" onCancel={e => { e.preventDefault(); if (!working) onClose(); }} onClick={e => { if (e.target === e.currentTarget && !working) onClose(); }}><div className="dialog-content"><div className="dialog-heading"><Logo provider={provider}/><button className="icon-button" aria-label="Close connection dialog" disabled={working} onClick={onClose}><Icon name="close"/></button></div><h2 id="connection-title">{connection ? 'Manage' : 'Connect'} {meta[provider].name}</h2><p>One independent connection. Stored on this device.</p>
    <div className="info-box"><Icon name="shield" size={20}/><div><strong>Read-only requests</strong><p>{meta[provider].permission}</p><a href={meta[provider].keys} target="_blank" rel="noreferrer">Get an API token ↗</a></div></div>
    {provider !== 'vercel' && <div className="capability"><p>Direct browser access was restricted in our tests. Check this origin before entering credentials.</p><button className="button secondary" disabled={working} onClick={async () => { setWorking(true); setError(''); try { const result = await checkBrowser(provider); setCapability(result); setChecked(true); if (!result) setError('The API did not return a usable response.'); } catch { setCapability(false); setChecked(true); setError('Browser access is unavailable. CORS or connectivity may be blocking it. This provider cannot connect directly right now.'); } finally { setWorking(false); } }}>{working ? 'Checking…' : capability && checked ? 'Browser access available · recheck' : 'Check browser access'}</button></div>}
    <form onSubmit={submit}><fieldset disabled={working}><label>API token<input type="password" autoComplete="off" spellCheck={false} value={token} onChange={e => setToken(e.target.value)} placeholder={connection?.mode === 'encrypted' ? 'Leave empty to unlock saved token' : 'Paste your API token'} disabled={!capability && connection?.mode !== 'encrypted'}/></label><label>{meta[provider].scope}<input value={scope} onChange={e => setScope(e.target.value)} placeholder={provider === 'vercel' ? 'team_…' : provider === 'neon' ? 'org-…' : 'Account ID'} disabled={connection?.mode === 'encrypted' && !token}/></label>
    {!(connection?.mode === 'encrypted' && !token) && <label>Credential storage<select value={mode} onChange={e => setMode(e.target.value as Connection['mode'])}><option value="session">Memory only · cleared on reload</option><option value="encrypted">Encrypted on this device</option><option value="plain">Unencrypted on this device</option></select></label>}
    {(mode === 'encrypted' || (connection?.mode === 'encrypted' && !token)) && <label>Passphrase<input type="password" autoComplete="off" minLength={token ? 12 : undefined} required value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="At least 12 characters"/><small>Never saved. A lost passphrase cannot be recovered.</small></label>}
    {mode === 'plain' && <p className="amber fine-print">Saved without encryption. Anyone with access to this browser profile can read the token.</p>}
    <p className="fine-print">Resource snapshots are cached unencrypted. API permissions are controlled by the provider; StackPulse cannot reduce an existing token’s privileges.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <button type="submit" className="button primary full" disabled={working || (!capability && connection?.mode !== 'encrypted')}>{working ? 'Working…' : connection?.mode === 'encrypted' && !token ? 'Unlock & refresh' : 'Save & refresh'}<Icon name="arrow" size={16}/></button>
    </fieldset></form>{connection && <div className="dialog-actions"><button className="text-button" disabled={working} onClick={onRefresh}>Refresh saved connection</button><button className="text-button danger" disabled={working} onClick={async () => { if (!deleting) { setDeleting(true); return; } setWorking(true); try { await onDisconnect(provider); } catch (e) { setError(message(e)); setWorking(false); } }}>{deleting ? 'Confirm: erase token & snapshots' : 'Disconnect & erase'}</button></div>}
    <a className="docs-link" href={meta[provider].docs} target="_blank" rel="noreferrer">Official API documentation <Icon name="external" size={13}/></a>
  </div></dialog>;
}

