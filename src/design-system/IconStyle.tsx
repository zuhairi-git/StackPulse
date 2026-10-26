import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Dropdown } from './Dropdown';

const fontFiles = import.meta.glob<string>('../../fa-kit-60396e54cd-web/webfonts/fa-*duotone-*.woff2', { eager: true, query: '?url', import: 'default' });
export const iconStyles = [
  { value: 'duotone-thin', label: 'Duotone Thin', file: 'fa-duotone-thin-100.woff2', weight: 100 },
  { value: 'duotone-light', label: 'Duotone Light', file: 'fa-duotone-light-300.woff2', weight: 300 },
  { value: 'duotone-regular', label: 'Duotone Regular', file: 'fa-duotone-regular-400.woff2', weight: 400 },
  { value: 'sharp-duotone-light', label: 'Sharp Duotone Light', file: 'fa-sharp-duotone-light-300.woff2', weight: 300 },
  { value: 'sharp-duotone-regular', label: 'Sharp Duotone Regular', file: 'fa-sharp-duotone-regular-400.woff2', weight: 400 },
  { value: 'sharp-duotone-solid', label: 'Sharp Duotone Solid', file: 'fa-sharp-duotone-solid-900.woff2', weight: 900 },
].map(style => ({ ...style, url: fontFiles[`../../fa-kit-60396e54cd-web/webfonts/${style.file}`] }));
export const availableIconStyles = iconStyles.filter(style => !!style.url);
export const iconStyleKey = 'stackpulse-icon-style';
export function resolveIconStyle(value: string | null) {
  return availableIconStyles.find(style => style.value === value) || availableIconStyles[0];
}
function loadIconStyle() {
  try { return resolveIconStyle(localStorage.getItem(iconStyleKey)).value; }
  catch { return resolveIconStyle(null).value; }
}
const IconStyleContext = createContext({ value: 'duotone-thin', change: (_value: string) => {} });
export function IconStyleProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(loadIconStyle);
  const selected = resolveIconStyle(value);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === iconStyleKey || event.key === null) setValue(loadIconStyle()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const change = (next: string) => {
    const valid = resolveIconStyle(next).value;
    setValue(valid);
    try { localStorage.setItem(iconStyleKey, valid); } catch { /* Keep the selection for this session when storage is unavailable. */ }
  };
  const faces = availableIconStyles.map(style => `@font-face{font-family:"StackPulse-${style.value}";font-style:normal;font-weight:${style.weight};font-display:block;src:url("${style.url}") format("woff2");}`).join('');
  return <IconStyleContext.Provider value={{ value, change }}><style>{faces + `:root{--ds-icon-family:"StackPulse-${selected.value}";--ds-icon-weight:${selected.weight};}`}</style>{children}</IconStyleContext.Provider>;
}
export function IconStyleSettings() {
  const { value, change } = useContext(IconStyleContext);
  return <div className="setting-row"><div><strong>Icon style</strong><small>Changes every interface icon immediately and is saved on this device.</small>{availableIconStyles.length === 1 && <small>Duotone Thin is installed. Add another kit font file to make its style available here.</small>}</div><Dropdown label="Icon style" value={value} onChange={change} options={availableIconStyles.map(style => ({ value: style.value, label: style.label }))}/></div>;
}

