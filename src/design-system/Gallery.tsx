import { IconStyleSettings } from './IconStyle';
import { useRef, useState, type ReactNode } from 'react';
import { NavigationItem, SearchField, Switch, Badge, Button, Dialog, Dot, Dropdown, EmptyState, Icon, InfoBox, Input, Logo, Metric, Notice, Panel, ProviderCard, ProviderOption, SectionHeading, SettingRow, Tabs, MetricGroup, ProviderGrid, ProviderCardHeader, ProviderCardBody, ProviderCardFooter, TableContainer, DataTable, DialogContent, DialogHeading } from './index';
import { meta, providers } from '../model';

const icons = ['grid', 'palette', 'pulse', 'link', 'settings', 'arrow', 'external', 'refresh', 'shield', 'lock', 'plus', 'search', 'clock', 'download', 'close', 'box'];
function Example({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <Panel><SectionHeading><h2>{title}</h2></SectionHeading><p>{description}</p><div className="ds-preview">{children}</div></Panel>;
}
export function DesignSystemGallery() {
  const [selection, setSelection] = useState('vercel');
  const [nav, setNav] = useState('Settings');
  const [tab, setTab] = useState('All providers');
  const [enabled, setEnabled] = useState(true);
  const [notice, setNotice] = useState(true);
  const [query, setQuery] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  return <div className="ds-gallery">
    <p>StackPulse’s shared foundations and components. These examples use the same components as the app. Try the controls to explore their behavior.</p>
    <Example title="Foundations" description="Semantic colors, spacing, typography, and corner radii define the shared visual language.">
      <div className="ds-swatches">{['background', 'surface', 'surface-raised', 'text', 'muted', 'border', 'accent', 'primary', 'success', 'warning', 'danger'].map(name => <div key={name}><span style={{ background: `var(--ds-${name})` }}/><small>{name}</small></div>)}</div>
      <div className="ds-row">{[1, 2, 3, 4, 6, 8].map(n => <div key={n}><div className="ds-spacing" style={{ width: `var(--ds-space-${n})` }}/><small>space-{n}</small></div>)}</div>
      <div><h1>Page heading</h1><h2>Section heading</h2><h3>Card heading</h3><p>Body text with muted supporting content.</p><small>Small supporting label</small></div>
      <div className="ds-row">{['sm', 'md', 'lg'].map(size => <span className="ds-radius" key={size} style={{ borderRadius: `var(--ds-radius-${size})` }}>{size}</span>)}</div>
    </Example>
    <Example title="Buttons & navigation" description="Primary, secondary, text, icon, and compact connection actions; disabled and busy states.">
      <div className="ds-row"><Button variant="primary">Connect provider <Icon name="plus" size={16}/></Button><Button>Secondary</Button><Button variant="text">Manage <Icon name="arrow" size={16}/></Button><Button variant="icon" aria-label="Refresh example"><Icon name="refresh"/></Button><Button variant="connect">Add account</Button><Button disabled>Disabled</Button><Button disabled aria-busy="true">Refreshing…</Button></div>
      <Tabs role="group" aria-label="Example provider filter">{['All providers', 'Vercel', 'Neon'].map(name => <Button key={name} className={tab === name ? 'selected' : ''} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</Button>)}</Tabs><small>Selected: {tab}</small><nav className="ds-navigation-preview" aria-label="Example navigation">{[['Overview', 'grid'], ['Connections', 'link'], ['Settings', 'settings'], ['Design system', 'palette']].map(([label, icon]) => <NavigationItem key={label} label={label} icon={icon} active={nav === label} onClick={() => setNav(label)}/>)}</nav>
    </Example>
    <Example title="Forms & dropdowns" description="Native form fields support validation, hints, passwords, and disabled states. Dropdowns support keyboard navigation.">
      <form onSubmit={event => event.preventDefault()}><label>Account label<Input placeholder="Personal account"/></label><label>API token<Input type="password" autoComplete="off" placeholder="Example only"/><small>Demo fields do not save credentials.</small></label><label>Unavailable field<Input disabled placeholder="Disabled"/></label><label>Invalid field<Input aria-invalid="true" aria-describedby="ds-error" defaultValue="Invalid value"/></label><p id="ds-error" className="error">Enter a valid account label.</p><label>Provider<Dropdown label="Example provider" value={selection} onChange={setSelection} options={providers.map(p => ({ value: p, label: meta[p].name }))}/></label><Dropdown label="Disabled example" disabled value="none" onChange={() => {}} options={[{ value: 'none', label: 'Unavailable' }]}/></form>
    </Example>
    <Example title="Status & feedback" description="Badges, status indicators, dismissible notices, information panels, and errors.">
      <div className="ds-row"><Badge><Dot/>Locked</Badge><Badge className="badge green"><Dot className="dot green"/>Connected</Badge><Badge className="badge amber"><Dot className="dot amber"/>Stale data</Badge><Badge>Refreshing</Badge></div>
      {notice ? <Notice role="status"><span>Connection settings saved.</span><Button variant="icon" aria-label="Dismiss example notice" onClick={() => setNotice(false)}><Icon name="close" size={16}/></Button></Notice> : <Button onClick={() => setNotice(true)}>Show notice</Button>}
      <InfoBox><Icon name="shield"/><div><strong>Read-only requests</strong><p>Each provider works independently.</p></div></InfoBox><p className="error" role="status">Example error: Unable to refresh this connection.</p>
    </Example>
    <Example title="Cards, metrics & settings" description="Shared containers compose provider summaries, dashboard statistics, and settings rows.">
      <MetricGroup className="metrics"><Metric><div>Visible resources<Icon name="box" size={16}/></div><strong>12</strong><span>Latest snapshots</span></Metric><Metric><div>Needs attention<Icon name="pulse" size={16}/></div><strong>0</strong><span>Everything is current</span></Metric></MetricGroup>
      <ProviderGrid className="provider-grid">{providers.map(provider => <ProviderCard key={provider}><ProviderCardHeader className="provider-card-top"><Logo provider={provider}/><Badge className="badge green">Connected</Badge></ProviderCardHeader><h3>{meta[provider].name}</h3><span className="provider-category">Example account</span><ProviderCardBody className="provider-body"><strong className="resource-count">4 <span>{meta[provider].resourceLabel}</span></strong><p className="fine-print">Sample snapshot for component preview.</p></ProviderCardBody><ProviderCardFooter className="provider-card-footer"><span>Just now</span><Button variant="text" onClick={() => dialog.current?.showModal()}>Manage <Icon name="arrow" size={14}/></Button></ProviderCardFooter></ProviderCard>)}</ProviderGrid>
      <SettingRow><div><strong>Provider activation</strong><small>Try the shared switch pattern.</small></div><Switch checked={enabled} onCheckedChange={setEnabled}>{enabled ? 'Active' : 'Inactive'}</Switch></SettingRow>
    </Example>
    <Example title="Search, tables & empty states" description="Resource lists share searchable controls, tabular data, and helpful empty states.">
      <SearchField label="Search example resources" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search resources…"/>
      {'production'.includes(query.toLowerCase()) ? <TableContainer className="table-wrap"><DataTable><thead><tr><th>Resource</th><th>Provider / account</th><th>Reported state</th></tr></thead><tbody><tr><td><strong>production</strong><small>Example project</small></td><td>Vercel<small>Example account</small></td><td><Badge>Ready</Badge></td></tr></tbody></DataTable></TableContainer> : <EmptyState><span className="empty-icon"><Icon name="search" size={25}/></span><h3>No matching resources</h3><p>Try a different search.</p><Button variant="text" onClick={() => setQuery('')}>Clear search</Button></EmptyState>}
      <EmptyState><span className="empty-icon"><Icon name="box" size={25}/></span><h3>Your stack starts here</h3><p>Connect a provider to see resources.</p></EmptyState>
    </Example>
    <Example title="Dialogs & provider selection" description="Native modal dialogs manage focus, Escape dismissal, and a shared backdrop.">
      <Button onClick={() => dialog.current?.showModal()}>Open example dialog</Button>
      <Dialog ref={dialog} aria-labelledby="ds-dialog-title" onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}><DialogContent className="dialog-content"><DialogHeading className="dialog-heading"><h2 id="ds-dialog-title">Choose a provider</h2><Button variant="icon" aria-label="Close example dialog" onClick={() => dialog.current?.close()}><Icon name="close"/></Button></DialogHeading><p>Select a demo provider. This does not create a connection.</p><div className="provider-options">{providers.map(provider => <ProviderOption key={provider} onClick={() => { setSelection(provider); dialog.current?.close(); }}><Logo provider={provider}/><span><strong>{meta[provider].name}</strong><small>{meta[provider].category}</small></span><Icon name="arrow" size={18}/></ProviderOption>)}</div></DialogContent></Dialog>
    </Example>
    <Example title="Icons & provider logos" description="Font Awesome Duotone icons inherit color and size. Change the style to update the entire app."><IconStyleSettings/><div className="ds-icons">{icons.map(name => <div key={name}><Icon name={name}/><small>{name}</small></div>)}</div><div className="ds-row">{providers.map(provider => <Logo key={provider} provider={provider}/>)}</div></Example>
  </div>;
}

