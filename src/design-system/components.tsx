import { Icon } from './Brand';
import type { ComponentProps } from 'react';

/** Native props (including refs and accessibility attributes) pass through unchanged. */
export function Button({ variant, className, ...props }: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'text' | 'icon' | 'connect' }) {
  const styles = { primary: 'button primary', secondary: 'button secondary', text: 'text-button', icon: 'icon-button', connect: 'connect-button' };
  return <button className={className ?? styles[variant ?? 'secondary']} {...props}/>;
}
export function Input(props: ComponentProps<'input'>) { return <input {...props}/>; }
export function Dialog(props: ComponentProps<'dialog'>) { return <dialog {...props}/>; }
export function Panel({ className = 'panel', ...props }: ComponentProps<'section'>) { return <section className={className} {...props}/>; }
export function ProviderCard({ className = 'provider-card', ...props }: ComponentProps<'article'>) { return <article className={className} {...props}/>; }
export function Metric({ className = 'metric', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function SectionHeading({ className = 'section-heading', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function SettingRow({ className = 'setting-row', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function InfoBox({ className = 'info-box', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function Notice({ className = 'notice', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function EmptyState({ className = 'empty', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function Tabs({ className = 'tabs', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function Badge({ className = 'badge', ...props }: ComponentProps<'span'>) { return <span className={className} {...props}/>; }
export function Dot({ className = 'dot', ...props }: ComponentProps<'span'>) { return <span className={className} {...props}/>; }
export function ProviderOption({ className = 'provider-option', ...props }: ComponentProps<'button'>) { return <button className={className} {...props}/>; }
export function DialogContent({ className = 'dialog-content', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function DialogHeading({ className = 'dialog-heading', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function ProviderCardHeader({ className = 'provider-card-top', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function ProviderCardBody({ className = 'provider-body', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function ProviderCardFooter({ className = 'provider-card-footer', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function PageHeading({ className = 'page-heading', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function MetricGroup({ className = 'metrics', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function ProviderGrid({ className = 'provider-grid', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function TableContainer({ className = 'table-wrap', ...props }: ComponentProps<'div'>) { return <div className={className} {...props}/>; }
export function DataTable(props: ComponentProps<'table'>) { return <table {...props}/>; }
export function SearchField({ label, ...props }: Omit<ComponentProps<'input'>, 'aria-label'> & { label: string }) { return <label className="search"><Icon name="search" size={16}/><Input aria-label={label} {...props}/></label>; }
export function Switch({ checked, onCheckedChange, ...props }: Omit<ComponentProps<typeof Button>, 'role' | 'aria-checked' | 'onClick'> & { checked: boolean; onCheckedChange: (checked: boolean) => void }) { return <Button role="switch" aria-checked={checked} onClick={() => onCheckedChange(!checked)} {...props}/>; }

export function NavigationItem({ label, icon, active = false, count, ...props }: Omit<ComponentProps<'button'>, 'children'> & { label: string; icon: string; active?: boolean; count?: number }) {
  return <button type="button" className={active ? 'nav-item active' : 'nav-item'} aria-label={label} title={label} aria-current={active ? 'page' : undefined} {...props}><Icon name={icon}/><span className="nav-item-label">{label}</span>{count !== undefined && <span className="nav-count">{count}</span>}</button>;
}
