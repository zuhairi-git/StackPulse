import type { Provider } from '../model';
const iconNames: Record<string, string> = {
  grid: 'grid-2', palette: 'palette', pulse: 'wave-pulse', link: 'link', settings: 'gear',
  arrow: 'arrow-right', external: 'arrow-up-right-from-square', refresh: 'arrows-rotate',
  shield: 'shield-check', lock: 'lock', plus: 'plus', search: 'magnifying-glass', clock: 'clock',
  download: 'download', close: 'xmark', box: 'box', chevron: 'chevron-down', check: 'check',
};
export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return <i className={`ds-icon fa-duotone fa-${iconNames[name] || 'box'} ${className}`} style={{ fontSize: size, width: size, height: size }} aria-hidden="true"/>;
}
export function Logo({ provider }: { provider: Provider }) {
  return <span className={`provider-logo ${provider}`} aria-hidden="true">{provider === 'vercel' ? <svg viewBox="0 0 32 32"><path fill="currentColor" d="M16 5 30 28H2Z"/></svg> : provider === 'neon' ? <svg viewBox="0 0 32 32"><path d="M7 26V6h19v20H16V14l10 12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round"/></svg> : provider === 'cloudflare' ? <svg viewBox="0 0 40 32"><path fill="currentColor" d="M7 25a6 6 0 0 1-1-12 10 10 0 0 1 19-2 7 7 0 0 1 8 7h1a4 4 0 0 1 0 8H7Z"/></svg> : <Icon name="box"/>}</span>;
}
