import { NavigationItem, SearchField, Switch, Button, Dot, Notice, Panel, SectionHeading, SettingRow, InfoBox, Metric, ProviderCard, Input, Tabs, Badge, EmptyState, Dialog, ProviderOption, Icon, Logo, Dropdown, PageHeading, MetricGroup, ProviderGrid, ProviderCardHeader, ProviderCardBody, ProviderCardFooter, TableContainer, DataTable, DialogContent, DialogHeading } from './design-system';
import { IconStyleSettings } from './design-system/IconStyle';
import { DesignSystemGallery } from './design-system/Gallery';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { meta, providers, stale, defaultWorkspaceId, type Workspace, type Connection, type Provider, type Snapshot } from './model';
import { all, save, saveConnection, saveWorkspace, moveConnection, remove, encrypt, decrypt } from './storage';
import { checkBrowser, fetchSnapshot } from './providers';
import { AccountPanel, cloudAccount } from './account';
import { connectionsForProviders, loadEnabledProviders, providerSettingsKey } from './provider-settings';
import { loadWorkspaceSelection, workspaceConnections, workspaceSnapshots, workspaceSelectionKey } from './workspaces';

const ago = (at?: number) => !at ? 'Never synced' : Date.now() - at < 60_000 ? 'Just now' : `${Math.floor((Date.now() - at) / 60_000)}m ago`;
const refreshedAt = (at: number) => new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
function RefreshTime({ at }: { at?: number }) {
  return at ? <time dateTime={new Date(at).toISOString()} title={new Date(at).toString()}>{refreshedAt(at)}</time> : <>Never refreshed</>;
}
function savedRefreshInterval() {
  try { const value = localStorage.getItem('stackpulse-refresh-interval'); return value === '60' ? 60 : value === '300' ? 300 : 0; } catch { return 0; }
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function App() {
  const [page, setPage] = useState('Overview');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState(loadWorkspaceSelection);
  const workspaceRef = useRef(workspaceId);
  const [workspaceEditor, setWorkspaceEditor] = useState<Workspace | 'new'>();
  const [movingId, setMovingId] = useState<string>();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [enabledProviders, setEnabledProviders] = useState(loadEnabledProviders);
  const enabledRef = useRef(enabledProviders);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [busy, setBusy] = useState<Partial<Record<string, boolean>>>({});
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<{ provider: Provider; id?: string }>();
  const [choosingProvider, setChoosingProvider] = useState(false);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const [install, setInstall] = useState<InstallEvent>();
  const [interval, setIntervalSeconds] = useState(savedRefreshInterval);
  const [, tick] = useState(0);
  const tokens = useRef<Partial<Record<string, string>>>({});
  const requests = useRef<Partial<Record<string, AbortController>>>({});
  const [unlocked, setUnlocked] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all([all<Connection>('connections'), all<Snapshot>('snapshots'), all<Workspace>('workspaces')]).then(([c, s, w]) => { if (active) { setConnections(c); setSnapshots(s); setWorkspaces(w); const selected = w.some(x => x.id === workspaceRef.current) ? workspaceRef.current : defaultWorkspaceId; workspaceRef.current = selected; setWorkspaceId(selected); setReady(true); } }).catch(e => { if (active) setNotice(message(e)); });
    const net = () => setOnline(navigator.onLine);
    const prompt = (e: Event) => { e.preventDefault(); setInstall(e as InstallEvent); };
    const offlineFailed = () => setNotice('Offline shell could not be installed. Check browser storage permissions.');
    window.addEventListener('online', net); window.addEventListener('offline', net); window.addEventListener('beforeinstallprompt', prompt); window.addEventListener('stackpulse-offline-unavailable', offlineFailed);
    const timer = window.setInterval(() => tick(n => n + 1), 15000);
    return () => { active = false; clearInterval(timer); window.removeEventListener('online', net); window.removeEventListener('offline', net); window.removeEventListener('beforeinstallprompt', prompt); window.removeEventListener('stackpulse-offline-unavailable', offlineFailed); };
  }, []);
  const currentWorkspace = workspaces.find(w => w.id === workspaceId);
  const currentConnections = workspaceConnections(connections, workspaceId);
  const activeConnections = connectionsForProviders(currentConnections, enabledProviders);
  const activeSnapshots = workspaceSnapshots(snapshots, activeConnections);
  const refreshing = activeConnections.some(c => busy[c.id]);
  async function refresh(connection: Connection, supplied?: string) {
    const p = connection.id; const token = supplied || tokens.current[p] || connection.token;
    if (connection.workspaceId !== workspaceRef.current || !enabledRef.current.includes(connection.provider) || !token || !navigator.onLine || requests.current[p]) return;
    const controller = new AbortController(); requests.current[p] = controller;
    const timeout = window.setTimeout(() => controller.abort(new DOMException('Refresh timed out. Cached data was preserved.', 'TimeoutError')), 15000); setBusy(b => ({ ...b, [p]: true }));
    try {
      const snapshot = await fetchSnapshot(connection.provider, token, connection.scope, controller.signal, connection.id);
      if (controller.signal.aborted) return;
      await save(snapshot, 'snapshots');
      if (!controller.signal.aborted) { setSnapshots(s => [...s.filter(x => x.connectionId !== p), snapshot]); setErrors(e => ({ ...e, [p]: undefined })); }
    } catch (e) { if (connection.workspaceId === workspaceRef.current && enabledRef.current.includes(connection.provider) && (!controller.signal.aborted || controller.signal.reason?.name === 'TimeoutError')) setErrors(old => ({ ...old, [p]: message(controller.signal.aborted ? controller.signal.reason : e) })); }
    finally { clearTimeout(timeout); if (requests.current[p] === controller) { delete requests.current[p]; setBusy(b => ({ ...b, [p]: false })); } }
  }
  function changeRefreshInterval(value: number) {
    setIntervalSeconds(value);
    try { localStorage.setItem('stackpulse-refresh-interval', String(value)); }
    catch { setNotice('Refresh mode changed for this session, but could not be saved on this device.'); }
  }
  const refreshAll = () => activeConnections.forEach(c => void refresh(c));
  useEffect(() => {
    if (!interval) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) refreshAll(); }, interval * 1000);
    return () => clearInterval(timer);
  }, [interval, connections, enabledProviders, workspaceId]);
  function selectWorkspace(id: string) {
    Object.values(requests.current).forEach(request => request?.abort());
    workspaceRef.current = id; setWorkspaceId(id); setModal(undefined); setChoosingProvider(false); setFilter('all'); setQuery('');
    try { localStorage.setItem(workspaceSelectionKey, id); }
    catch { setNotice('Workspace switched for this session, but the selection could not be saved on this device.'); }
  }
  async function storeWorkspace(workspace: Workspace) {
    const saved = await saveWorkspace(workspace);
    setWorkspaces(current => [...current.filter(w => w.id !== saved.id), saved].sort((a,b) => a.createdAt - b.createdAt));
    setWorkspaceEditor(undefined); selectWorkspace(saved.id);
  }
  async function moveAccount(id: string, target: string) {
    setMovingId(id); requests.current[id]?.abort();
    try { const moved = await moveConnection(id, target); setConnections(current => current.map(c => c.id === id ? moved : c)); setNotice('Account moved. Its credentials and cached snapshots were kept.'); }
    catch (e) { setNotice(message(e)); }
    finally { setMovingId(undefined); }
  }
  function toggleProvider(provider: Provider) {
    const enabling = !enabledProviders.includes(provider);
    const next = enabling ? [...enabledProviders, provider] : enabledProviders.filter(p => p !== provider);
    enabledRef.current = next; setEnabledProviders(next);
    if (!enabling) {
      connections.filter(c => c.provider === provider).forEach(c => requests.current[c.id]?.abort());
      if (modal?.provider === provider) setModal(undefined);
      if (filter === provider) setFilter('all');
    }
    try { localStorage.setItem(providerSettingsKey, JSON.stringify(next)); }
    catch { setNotice('Provider activation changed for this session, but could not be saved on this device.'); }
  }
  function addAccount() {
    if (enabledProviders.length) setChoosingProvider(true); else setPage('Settings');
  }
  function lock() { Object.values(requests.current).forEach(c => c?.abort()); tokens.current = {}; setUnlocked([]); setNotice('Session credentials cleared. Encrypted credentials are locked. Unencrypted saved tokens remain accessible to this browser.'); }
  async function connect(connection: Connection, token: string, preserveSnapshot = false) {
    const id = connection.id;
    if (!enabledRef.current.includes(connection.provider)) throw new Error('Activate this provider in Settings first.');
    if (requests.current[id]) throw new Error('A refresh is in progress. Wait for it to finish before changing credentials.');
    await saveConnection(connection, !preserveSnapshot); tokens.current[id] = token;
    if (!preserveSnapshot) setSnapshots(s => s.filter(x => x.connectionId !== id));
    setErrors(e => ({ ...e, [id]: undefined }));
    setUnlocked(u => [...u.filter(key => key !== id), id]);
    setConnections(c => [...c.filter(x => x.id !== id), connection]); setModal(undefined);
    await refresh(connection, token);
  }
  async function disconnect(id: string) {
    requests.current[id]?.abort(); await remove(id); delete tokens.current[id];
    setUnlocked(u => u.filter(key => key !== id)); setConnections(c => c.filter(x => x.id !== id)); setSnapshots(s => s.filter(x => x.connectionId !== id)); setErrors(e => ({ ...e, [id]: undefined })); setModal(undefined);
  }
  const connectionName = (c: Connection) => c.label || snapshots.find(s => s.connectionId === c.id)?.accountName || c.scope || ('Account ' + c.id.slice(-8));
  const resources = activeSnapshots.flatMap(s => s.resources.map(r => ({ ...r, provider: s.provider, connectionId: s.connectionId, account: connections.find(c => c.id === s.connectionId) ? connectionName(connections.find(c => c.id === s.connectionId)!) : 'Unknown account', at: s.at })));
  const visible = resources.filter(r => (filter === 'all' || r.provider === filter) && `${r.name} ${r.detail} ${r.status} ${r.account}`.toLowerCase().includes(query.toLowerCase()));
  const latest = activeSnapshots.length ? Math.max(...activeSnapshots.map(s => s.at)) : undefined;
  const attention = activeConnections.filter(c => errors[c.id] || stale(snapshots.find(s => s.connectionId === c.id), false, online)).length;
  const accessible = activeConnections.filter(c => unlocked.includes(c.id) || c.token).length;
  return <div className="app">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('Overview'); }}><img src={`${import.meta.env.BASE_URL}icon.svg`} alt=""/><span>StackPulse<span className="brand-dot">.</span></span></a>
      <div className="workspace"><span className="workspace-avatar">{currentWorkspace?.name.slice(0,1) || 'S'}</span><div>{currentWorkspace?.name || 'Loading workspace…'}<small>Local to this device</small></div><Icon name="lock" size={14}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{[['Overview', 'grid'], ['Connections', 'link'], ['Settings', 'settings'], ['Design system', 'palette']].map(([label, icon]) => <NavigationItem key={label} label={label} icon={icon} active={page === label} onClick={() => setPage(label)} count={label === 'Connections' ? currentConnections.length : undefined}/>)}</nav>
      <div className="sidebar-bottom"><div className="private-card"><Icon name="shield"/><strong>Yours. By design.</strong><p>Use this device as a guest, or sign in to save connection settings.</p><Button variant="text" onClick={() => setPage('Settings')}>Privacy & storage <Icon name="arrow" size={15}/></Button></div><Button className="install-button" onClick={async () => { if (install) { await install.prompt(); await install.userChoice; setInstall(undefined); } else setNotice('To install StackPulse, use your browser’s Install app menu. On iOS: Share → Add to Home Screen. Installation requires HTTPS or localhost.'); }}><Icon name="download" size={17}/> Install StackPulse</Button><div className="version"><Dot className="dot green"/>Local-first <span>v0.1.0</span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><span className="breadcrumb">{currentWorkspace?.name || 'Workspace'} <span>/</span> <strong>{page}</strong></span><div><label className="workspace-switcher"><span className="sr-only">Workspace</span><Dropdown label="Workspace" disabled={!ready} value={workspaceId} onChange={selectWorkspace} options={workspaces.map(w => ({ value: w.id, label: w.name }))}/></label><Button className="icon-button new-workspace" aria-label="New workspace" title="New workspace" disabled={!ready} onClick={() => setWorkspaceEditor('new')}><Icon name="plus" size={18}/></Button><span className={`network ${online ? '' : 'amber'}`}><Dot className={`dot ${online ? 'green' : 'amber'}`}/>{online ? 'Device online' : 'Offline · cached data'}</span><AccountPanel/></div></header>
    <main>
      {notice && <Notice className="notice" role="status"><span>{notice}</span><Button className="" aria-label="Dismiss message" onClick={() => setNotice('')}><Icon name="close" size={16}/></Button></Notice>}
      <PageHeading className="page-heading"><div><div className="eyebrow">YOUR STACK, AT A GLANCE</div><h1>{page}</h1><p>{page === 'Overview' ? 'Your infrastructure. One pulse.' : page === 'Connections' ? 'All your accounts. One place to check in.' : page === 'Design system' ? 'Shared foundations. Reusable components.' : 'A small app. Entirely on your terms.'}</p></div></PageHeading>
      {page !== 'Design system' && <section className="refresh-toolbar" aria-label="Dashboard refresh controls">
        <div className="refresh-preferences"><label>Refresh mode<Dropdown label="Refresh mode" value={interval ? 'auto' : 'manual'} onChange={value => changeRefreshInterval(value === 'auto' ? 300 : 0)} options={[{ value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Auto' }]}/></label>{!!interval && <label>Frequency<Dropdown label="Auto refresh frequency" value={String(interval)} onChange={value => changeRefreshInterval(Number(value))} options={[{ value: '60', label: 'Every minute' }, { value: '300', label: 'Every 5 minutes' }]}/></label>}<Button variant="secondary" disabled={!accessible || refreshing || !online} onClick={refreshAll}><Icon name="refresh" size={16}/>{refreshing ? 'Refreshing…' : 'Refresh all'}</Button></div>
        <div className="refresh-details"><span>Last successful refresh in this workspace: <RefreshTime at={latest}/></span><small>{interval ? 'Auto refresh applies to active providers in this workspace while this tab is visible, online, and credentials are available.' : 'Manual mode applies to active providers in this workspace. Use Refresh all or a provider’s Refresh button.'} Connecting or unlocking also refreshes that provider.</small></div>
      </section>}
      {page === 'Design system' ? <DesignSystemGallery/> : page === 'Settings' ? <div className="settings-layout"><Panel className="panel"><SectionHeading className="section-heading"><h2>Workspaces</h2><Button variant="primary" disabled={!ready} onClick={() => setWorkspaceEditor('new')}><Icon name="plus" size={14}/>New workspace</Button></SectionHeading><p>Group your provider accounts by project, client, or team. Views and refreshes follow the selected workspace. Provider activation and Auto/Manual preferences are shared across the app.</p>{workspaces.map(w => <SettingRow className="setting-row" key={w.id}><div><strong>{w.name}{w.id === workspaceId ? ' · current' : ''}</strong><small>{connections.filter(c => c.workspaceId === w.id).length} saved accounts</small></div><div className="workspace-actions"><Button variant="secondary" onClick={() => setWorkspaceEditor(w)}>Rename</Button>{w.id !== workspaceId && <Button variant="secondary" onClick={() => selectWorkspace(w.id)}>Switch</Button>}</div></SettingRow>)}{currentConnections.length > 0 && <><h3>Organize accounts in {currentWorkspace?.name}</h3>{currentConnections.map(c => <SettingRow className="setting-row" key={c.id}><div><strong>{meta[c.provider].name} · {connectionName(c)}</strong><small>Moving keeps credentials and cached snapshots.</small></div><label className="account-workspace-label">Move to workspace<Dropdown label={'Workspace for ' + meta[c.provider].name + ' ' + connectionName(c)} disabled={!!movingId} value={c.workspaceId} onChange={value => void moveAccount(c.id, value)} options={workspaces.map(w => ({ value: w.id, label: w.name }))}/></label></SettingRow>)}</>}<p className="fine-print">Workspaces are saved in this browser. They organize your accounts; they do not add team sharing or change provider permissions.</p></Panel><Panel className="panel"><h2>Providers & integrations</h2><p>Activate the platforms you want in your workspace, then add their accounts. Deactivated providers are hidden and stop refreshing. Saved connections and snapshots are kept.</p><div className="integration-list">{providers.map(p => {
        const enabled = enabledProviders.includes(p);
        const count = currentConnections.filter(c => c.provider === p).length;
        return <SettingRow className="setting-row integration-row" key={p}><Logo provider={p}/><div className="integration-copy"><strong>{meta[p].name}</strong><small>{meta[p].description} · {count} saved {count === 1 ? 'account' : 'accounts'}</small></div><div className="integration-actions"><Switch className="button secondary" checked={enabled} aria-label={'Activate ' + meta[p].name} onCheckedChange={() => toggleProvider(p)}>{enabled ? 'Active · deactivate' : 'Activate'}</Switch>{enabled && <Button variant="primary" disabled={!ready} onClick={() => setModal({ provider: p })}><Icon name="plus" size={14}/>Add account</Button>}</div></SettingRow>;
      })}</div><p className="fine-print">New integrations become available here when included in a StackPulse update. Activation is saved on this device, applies to every workspace, and does not connect an account by itself.</p></Panel><Panel className="panel"><h2>Appearance</h2><IconStyleSettings/></Panel><Panel><h2>Device & privacy</h2><p>Guest data stays on this device. Activated Google accounts sync connection fields only; resource snapshots are never sent to the account database.</p><SettingRow className="setting-row"><div><strong>App-wide refresh mode: {interval ? 'Auto' : 'Manual'}</strong><small>Change mode using the refresh controls above on any page. Your choice is saved on this device.</small></div></SettingRow><SettingRow className="setting-row"><div><strong>Clear session credentials</strong><small>Also locks passphrase-protected connections.</small></div><Button variant="secondary" onClick={lock}><Icon name="lock" size={16}/>Lock session</Button></SettingRow><SettingRow className="setting-row"><div><strong>Cached account data</strong><small>Resource names and status snapshots are stored unencrypted in IndexedDB. Disconnect a provider to erase its data.</small></div><Button variant="text" onClick={() => setPage('Connections')}>Manage <Icon name="arrow" size={16}/></Button></SettingRow></Panel><Panel className="panel"><h2>Built to stay small</h2><p>React, TypeScript, and native browser APIs. No provider SDKs. No trackers. No background polling when the app is closed.</p><InfoBox className="info-box"><Icon name="shield"/><div><strong>Credential protection</strong><p>Choose memory-only, passphrase encryption, or unencrypted device storage per connection. Encryption uses AES-256-GCM and PBKDF2. Your passphrase is never saved. Encryption protects stored tokens, not an unlocked tab or compromised device.</p></div></InfoBox><p className="fine-print">Refresh preferences are saved on this device. Offline installation is available in the production build.</p></Panel></div> : <>
      {page === 'Overview' && <><section className="hero"><div className="hero-copy"><span className="hero-label"><Dot className={`dot ${attention ? 'amber' : 'blue'}`}/>{currentConnections.length ? attention ? 'YOUR STACK NEEDS A CHECK-IN' : 'YOUR WORKSPACE IS CONNECTED' : 'A LITTLE LESS TAB SWITCHING'}</span><h2>{currentConnections.length ? 'Your stack. In perspective.' : 'Meet your new control room.'}</h2><p>{currentConnections.length ? 'Independent connections. Clear snapshots. Everything in one quiet place.' : 'Connect your providers and bring your infrastructure into focus. Private, lightweight, and always close by.'}</p><Button variant="primary" onClick={addAccount}><Icon name="plus" size={17}/>{enabledProviders.length ? currentConnections.length ? 'Add an account' : 'Connect your first provider' : 'Activate providers in Settings'}<Icon name="arrow" size={17}/></Button></div><div className="topology" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><svg className="wires" viewBox="0 0 360 230"><path d="M180 115 80 55M180 115l110-40M180 115l35 90"/></svg><div className="node center"><Icon name="pulse" size={38}/></div><div className="node node-vercel"><Logo provider="vercel"/></div><div className="node node-neon"><Logo provider="neon"/></div><div className="node node-cloudflare"><Logo provider="cloudflare"/></div><span className="topology-caption">ONE CONNECTED VIEW</span></div></section>
      <MetricGroup className="metrics">{[["Connected providers", `${new Set(activeConnections.map(c => c.provider)).size}`, `/ ${enabledProviders.length}`, 'link'], ['Visible resources', activeSnapshots.length ? `${resources.length}` : '—', 'latest snapshots', 'box'], ['Needs attention', currentConnections.length ? `${attention}` : '—', 'errors or stale data', 'pulse'], ['Latest provider refresh', ago(latest), latest ? refreshedAt(latest) : 'waiting for a connection', 'clock']].map(([label, value, sub, icon]) => <Metric className="metric" key={label}><div>{label}<Icon name={icon} size={16}/></div><strong>{value}<small>{label === 'Connected providers' ? sub : ''}</small></strong><span>{label !== 'Connected providers' ? sub : `${activeConnections.length} active account connections`}</span></Metric>)}</MetricGroup></>}
      <section className="providers-section"><SectionHeading className="section-heading"><h2>Your accounts <span>{activeConnections.length}</span></h2><span className="subtle">{page === 'Connections' && <Button variant="text" onClick={addAccount}>Add an account · </Button>}<Button variant="text" onClick={() => setPage('Settings')}>Manage providers</Button></span></SectionHeading><ProviderGrid className="provider-grid">{activeConnections.map(c => {
        const p = c.provider;
        const id = c.id;
        const snapshot = snapshots.find(s => s.connectionId === id);
        const isStale = stale(snapshot, !!errors[id], online);
        const available = unlocked.includes(id) || !!c?.token;
        return <ProviderCard className="provider-card" key={id}>
          <ProviderCardHeader className="provider-card-top"><Logo provider={p}/><Badge className={`badge ${errors[id] || isStale ? 'amber' : c && available ? 'green' : ''}`}>{busy[id] ? 'Refreshing' : errors[id] ? 'Check connection' : isStale ? 'Stale data' : c ? available ? 'Connected' : 'Locked' : 'Add account'}</Badge></ProviderCardHeader>
          <h3>{meta[p].name}</h3><span className="provider-category">{c ? connectionName(c) : meta[p].category}</span>
          <ProviderCardBody className="provider-body">{c ? <>
            {snapshot?.accountName && <p className="account-name">Account: {snapshot.accountName}</p>}
            <small className="account-scope">{c.scope || 'All resources accessible to this token'}</small>
            {snapshot ? <><strong className="resource-count">{snapshot.resources.length}<span> {meta[p].resourceLabel}</span></strong><p className="fine-print">{snapshot.note}</p>{!snapshot.accountName && <p className="fine-print">Account name unavailable. Use a local label to identify this connection.</p>}</> : <p>No snapshot yet. Unlock or refresh this account to check.</p>}
          </> : <p>{meta[p].description} Add another independent account with its own token and scope.</p>}{errors[id] && <p className="error" role="status">{errors[id]}</p>}{!c && meta[p].requiresBrowserCheck && <span className="browser-note">Browser access may be restricted</span>}</ProviderCardBody>
          <ProviderCardFooter className="provider-card-footer">{c && <span className="provider-refreshed"><Icon name="clock" size={13}/><span>Last successful refresh<RefreshTime at={snapshot?.at}/>{snapshot && <small className={isStale ? 'amber' : ''}>{isStale ? 'Stale · ' : ''}{ago(snapshot.at)}</small>}</span></span>}
            <div className="provider-actions">{c && <Button variant="text" aria-label={'Refresh ' + meta[p].name + ' ' + connectionName(c)} disabled={!available || !!busy[id] || !online} onClick={() => void refresh(c)}><Icon name="refresh" size={14}/>{busy[id] ? 'Refreshing…' : 'Refresh'}</Button>}
            <Button className={c ? 'text-button' : 'connect-button'} disabled={!ready} onClick={() => setModal({ provider: p, id: c?.id })}>{c ? available ? 'Manage' : 'Unlock' : 'Add account'}<Icon name={c ? 'arrow' : 'plus'} size={14}/></Button></div>
          </ProviderCardFooter></ProviderCard>;
      })}</ProviderGrid></section>
      {page === 'Overview' ? <Panel className="resources panel"><SectionHeading className="section-heading"><h2>Resource snapshots <span>{resources.length}</span></h2><SearchField label="Search resources" placeholder="Search resources…" value={query} onChange={e => setQuery(e.target.value)}/></SectionHeading><Tabs className="tabs" role="group" aria-label="Filter resources">{['all', ...enabledProviders].map(p => <Button className={filter === p ? 'selected' : ''} onClick={() => setFilter(p)} key={p}>{p === 'all' ? 'All providers' : meta[p as Provider].name}</Button>)}</Tabs>{visible.length ? <TableContainer className="table-wrap"><DataTable><thead><tr><th>Resource</th><th>Provider / account</th><th>Reported state</th><th>Freshness</th><th><span className="sr-only">Dashboard</span></th></tr></thead><tbody>{visible.map(r => <tr key={r.connectionId + ":" + r.id}><td><strong>{r.name}</strong><small>{r.detail}</small></td><td>{meta[r.provider].name}<small>{r.account}</small></td><td><Badge className="badge">{r.status}</Badge></td><td><span className={stale(snapshots.find(s => s.connectionId === r.connectionId), !!errors[r.connectionId], online) ? 'amber' : 'subtle'}>{stale(snapshots.find(s => s.connectionId === r.connectionId), !!errors[r.connectionId], online) ? 'Stale · ' : ''}{ago(r.at)}<time className="resource-refreshed" dateTime={new Date(r.at).toISOString()}>{refreshedAt(r.at)}</time></span></td><td><a href={meta[r.provider].dashboard} target="_blank" rel="noreferrer" aria-label={`Open ${r.name} provider dashboard`}><Icon name="external" size={16}/></a></td></tr>)}</tbody></DataTable></TableContainer> : <EmptyState className="empty"><span className="empty-icon"><Icon name={resources.length ? 'search' : 'box'} size={25}/></span><h3>{resources.length ? 'No matching resources' : 'Your stack starts here'}</h3><p>{resources.length ? 'Try a different search or provider filter.' : 'Connect a provider to see real resources and their latest reported state.'}</p>{!resources.length && <Button variant="text" onClick={addAccount}>{enabledProviders.length ? 'Add a connection' : 'Activate providers in Settings'} <Icon name="arrow" size={16}/></Button>}</EmptyState>}</Panel> : <Panel className="panel browser-info"><Icon name="shield"/><div><h2>Browser security is part of the picture.</h2><p>Vercel allowed the tested browser requests. Neon and Cloudflare did not allow the tested localhost preflights on October 21, 2026. You can recheck access from this browser before entering a token. Availability can change by endpoint or origin; a network failure alone cannot prove CORS is the cause.</p><p>StackPulse never routes credentials through a third-party proxy. Each provider works independently.</p></div></Panel>}
      <footer><span><Icon name="shield" size={15}/>Local-first by design</span><span>No analytics<span className="footer-dot">·</span>Read-only requests<span className="footer-dot">·</span>Built for your peace of mind</span><span>StackPulse <span className="blue">↗</span></span></footer>
      </>}
    </main></div>
    {workspaceEditor && <WorkspaceDialog key={workspaceEditor === 'new' ? 'new' : workspaceEditor.id} workspace={workspaceEditor === 'new' ? undefined : workspaceEditor} onClose={() => setWorkspaceEditor(undefined)} onSave={storeWorkspace}/>}
    {choosingProvider && <ProviderPicker providers={enabledProviders} onClose={() => setChoosingProvider(false)} onSelect={provider => { setChoosingProvider(false); setModal({ provider }); }}/>}
    {modal && <ConnectionDialog key={modal.id || modal.provider} provider={modal.provider} workspaceId={workspaceId} connection={connections.find(c => c.id === modal.id)} onClose={() => setModal(undefined)} onConnect={connect} onDisconnect={disconnect} onRefresh={async () => { const c = connections.find(c => c.id === modal.id); if (c) await refresh(c); setModal(undefined); }}/ >}
  </div>;
}

function ProviderPicker({ providers, onClose, onSelect }: { providers: Provider[]; onClose: () => void; onSelect: (provider: Provider) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <Dialog ref={dialog} aria-labelledby="provider-picker-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><DialogContent className="dialog-content"><DialogHeading className="dialog-heading"><h2 id="provider-picker-title">Choose a provider</h2><Button variant="icon" aria-label="Close provider selection" onClick={onClose}><Icon name="close"/></Button></DialogHeading><p>Select the platform you want to connect.</p><div className="provider-options">{providers.map(provider => <ProviderOption className="provider-option" key={provider} onClick={() => onSelect(provider)}><Logo provider={provider}/><span><strong>{meta[provider].name}</strong><small>{meta[provider].category}</small></span><Icon name="arrow" size={18}/></ProviderOption>)}</div></DialogContent></Dialog>;
}

function WorkspaceDialog({ workspace, onClose, onSave }: { workspace?: Workspace; onClose: () => void; onSave: (workspace: Workspace) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(workspace?.name || '');
  const [error, setError] = useState(''); const [working, setWorking] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <Dialog ref={dialog} aria-labelledby="workspace-title" onCancel={e => { e.preventDefault(); if (!working) onClose(); }}><DialogContent className="dialog-content"><DialogHeading className="dialog-heading"><h2 id="workspace-title">{workspace ? 'Rename workspace' : 'New workspace'}</h2><Button variant="icon" aria-label="Close workspace dialog" disabled={working} onClick={onClose}><Icon name="close"/></Button></DialogHeading><p>Organize accounts for a project, client, or team on this device.</p><form className="workspace-form" onSubmit={async e => { e.preventDefault(); setWorking(true); setError(''); try { await onSave({ id: workspace?.id || crypto.randomUUID(), name, createdAt: workspace?.createdAt || Date.now() }); } catch (e) { setError(message(e)); setWorking(false); } }}><label>Workspace name<Input autoFocus required maxLength={60} value={name} onChange={e => setName(e.target.value)} disabled={working} placeholder="e.g. Client projects"/></label>{error && <p className="error" role="alert">{error}</p>}<Button className="button primary full" disabled={working || !name.trim()}>{working ? 'Saving…' : workspace ? 'Save name' : 'Create workspace'}</Button></form></DialogContent></Dialog>;
}

function ConnectionDialog({ provider, workspaceId, connection, onClose, onConnect, onDisconnect, onRefresh }: { provider: Provider; workspaceId: string; connection?: Connection; onClose: () => void; onConnect: (c: Connection, token: string, preserveSnapshot?: boolean) => Promise<void>; onDisconnect: (id: string) => Promise<void>; onRefresh: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [token, setToken] = useState(''); const [scope, setScope] = useState(connection?.scope || '');
  const [label, setLabel] = useState(connection?.label || '');
  const [mode, setMode] = useState<Connection['mode']>(connection?.mode || 'session'); const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState(''); const [working, setWorking] = useState(false); const [capability, setCapability] = useState(!meta[provider].requiresBrowserCheck);
  const [checked, setChecked] = useState(false); const [deleting, setDeleting] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); setWorking(true); setError('');
    try {
      if (connection?.mode === 'encrypted' && !token) { await onConnect({ ...connection, label: label.trim() }, await decrypt(connection.secret!, passphrase), true); return; }

      const clean = token.trim(); if (!clean || /\s/.test(clean)) throw new Error('Enter a valid API token without whitespace.');
      const c: Connection = { id: connection?.id || crypto.randomUUID(), workspaceId: connection?.workspaceId || workspaceId, label: label.trim(), provider, scope: scope.trim(), mode };
      if (mode === 'encrypted') c.secret = await encrypt(clean, passphrase); else if (mode === 'plain') c.token = clean;
      await onConnect(c, clean);
    } catch (e) { setError(message(e)); } finally { setWorking(false); }
  }
  return <Dialog ref={dialog} aria-labelledby="connection-title" onCancel={e => { e.preventDefault(); if (!working) onClose(); }} onClick={e => { if (e.target === e.currentTarget && !working) onClose(); }}><DialogContent className="dialog-content"><DialogHeading className="dialog-heading"><Logo provider={provider}/><Button variant="icon" aria-label="Close connection dialog" disabled={working} onClick={onClose}><Icon name="close"/></Button></DialogHeading><h2 id="connection-title">{connection ? 'Manage' : 'Connect'} {meta[provider].name}</h2><p>One independent connection. Guest settings stay on this device; activated accounts sync connection fields.</p>
    <InfoBox className="info-box"><Icon name="shield" size={20}/><div><strong>Read-only requests</strong><p>{meta[provider].permission}</p><a href={meta[provider].keys} target="_blank" rel="noreferrer">Get an API token ↗</a></div></InfoBox>
    {meta[provider].requiresBrowserCheck && <div className="capability"><p>Optionally check browser access. You can paste your token and try connecting even if this check fails.</p><Button variant="secondary" disabled={working} onClick={async () => { setWorking(true); setError(''); try { const result = await checkBrowser(provider); setCapability(result); setChecked(true); if (!result) setError('The API did not return a usable response.'); } catch { setCapability(false); setChecked(true); setError('The browser access check failed. You can still paste your token and try connecting. CORS or connectivity may block the connection; this check does not validate your token.'); } finally { setWorking(false); } }}>{working ? 'Checking…' : capability && checked ? 'Browser access available · recheck' : 'Check browser access'}</Button></div>}
    <form onSubmit={submit}><fieldset disabled={working}><label>Account label (optional)<Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Personal or Work" maxLength={100}/><small>We fetch the account name when available. A local label helps distinguish your connections.</small></label><label>API token<Input type="password" autoComplete="off" spellCheck={false} value={token} onChange={e => setToken(e.target.value)} placeholder={connection?.mode === 'encrypted' ? 'Leave empty to unlock saved token' : 'Paste your API token'}/></label><label>{meta[provider].scope}<Input value={scope} onChange={e => setScope(e.target.value)} placeholder={meta[provider].scopePlaceholder} aria-describedby="scope-help" disabled={connection?.mode === 'encrypted' && !token}/><small id="scope-help">{meta[provider].scopeHelp}</small></label>
    {!(connection?.mode === 'encrypted' && !token) && <label>Credential storage<Dropdown label="Credential storage" value={mode} onChange={value => setMode(value as Connection['mode'])} options={[{ value: 'session', label: 'Memory only · cleared on reload' }, { value: 'encrypted', label: 'Encrypted on this device' }, { value: 'plain', label: 'Unencrypted on this device' }]}/></label>}
    {(mode === 'encrypted' || (connection?.mode === 'encrypted' && !token)) && <label>Passphrase<Input type="password" autoComplete="off" minLength={token ? 12 : undefined} required value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="At least 12 characters"/><small>Never saved. A lost passphrase cannot be recovered.</small></label>}
    {mode === 'plain' && <p className="amber fine-print">{cloudAccount() ? 'Saved on this device and synced with server encryption to your Google account. Anyone with access to this browser profile can read the local token.' : 'Saved without encryption. Anyone with access to this browser profile can read the token.'}</p>}
    <p className="fine-print">Account names, labels, and resource snapshots are cached unencrypted. API permissions are controlled by the provider; StackPulse cannot reduce an existing token’s privileges.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <Button type="submit" className="button primary full" disabled={working}>{working ? 'Working…' : connection?.mode === 'encrypted' && !token ? 'Unlock & refresh' : 'Save & refresh'}<Icon name="arrow" size={16}/></Button>
    </fieldset></form>{connection && <div className="dialog-actions"><Button variant="text" disabled={working} onClick={onRefresh}>Refresh saved connection</Button><Button className="text-button danger" disabled={working} onClick={async () => { if (!deleting) { setDeleting(true); return; } setWorking(true); try { await onDisconnect(connection.id); } catch (e) { setError(message(e)); setWorking(false); } }}>{deleting ? 'Confirm: erase token & snapshots' : 'Disconnect & erase'}</Button></div>}
    <a className="docs-link" href={meta[provider].docs} target="_blank" rel="noreferrer">Official API documentation <Icon name="external" size={13}/></a>
  </DialogContent></Dialog>;
}
