import { Icon } from './Brand';
import { useId, useLayoutEffect, useRef, useState } from 'react';

type Option = { value: string; label: string };
export function Dropdown({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const search = useRef({ text: '', at: 0 });
  const selected = options.findIndex(option => option.value === value);
  const close = () => { menu.current?.hidePopover(); setOpen(false); };
  const show = (index = Math.max(0, selected)) => { if (disabled || !options.length) return; setActive(index); setOpen(true); };
  const choose = (index: number) => { const option = options[index]; if (option) onChange(option.value); close(); trigger.current?.focus(); };
  useLayoutEffect(() => {
    if (!open || disabled) { menu.current?.hidePopover(); return; }
    const position = () => {
      const rect = trigger.current!.getBoundingClientRect(), popup = menu.current!;
      const width = Math.min(Math.max(rect.width, 190), window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 16, above = rect.top - 16;
      const up = below < 180 && above > below;
      Object.assign(popup.style, { width: `${width}px`, left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`, top: up ? 'auto' : `${rect.bottom + 6}px`, bottom: up ? `${window.innerHeight - rect.top + 6}px` : 'auto', maxHeight: `${Math.min(300, Math.max(80, up ? above : below))}px` });
    };
    position(); menu.current?.showPopover();
    window.addEventListener('resize', position); window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open, disabled]);
  useLayoutEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, open, id]);
  return <span className="dropdown"><button ref={trigger} type="button" className="dropdown-trigger" role="combobox" aria-label={label} aria-expanded={open && !disabled} aria-controls={id} aria-haspopup="listbox" aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled || !options.length} onClick={() => open ? close() : show()} onKeyDown={e => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      if (!open) { show(e.key === 'End' ? options.length - 1 : e.key === 'Home' ? 0 : Math.max(0, selected)); return; }
      setActive(index => e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (open) choose(active); else show(); }
    else if (e.key === 'Escape') { if (open) { e.preventDefault(); e.stopPropagation(); close(); } }
    else if (e.key === 'Tab') close();
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      search.current = { text: (Date.now() - search.current.at < 700 ? search.current.text : '') + e.key.toLowerCase(), at: Date.now() };
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(search.current.text));
      if (index >= 0) { e.preventDefault(); if (open) setActive(index); else show(index); }
    }
  }}><span>{options[selected]?.label || 'Choose…'}</span><Icon name="chevron" size={16} className={open ? 'expanded' : ''}/></button><div ref={menu} id={id} popover="auto" className="dropdown-menu" role="listbox" aria-label={label} onToggle={e => { if ((e as unknown as { newState: string }).newState === 'closed') setOpen(false); }}>
    {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={value === option.value} className={`dropdown-option ${active === index ? 'highlighted' : ''}`} onPointerMove={() => setActive(index)} onPointerDown={e => e.preventDefault()} onClick={e => { e.preventDefault(); e.stopPropagation(); choose(index); }}><span>{option.label}</span><span className="dropdown-check" aria-hidden="true">{value === option.value && <Icon name="check" size={14}/>}</span></div>)}
  </div></span>;
}
