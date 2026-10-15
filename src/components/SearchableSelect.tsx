import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { HelpTip } from './HelpTip';

export interface SearchOption { value: string; label: string }
const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function SearchableSelect({ label, value, options, disabled, onChange, allowLocal = false, localValue, onLocal, clearable = true, hint }: {
  label: string; value: string; options: SearchOption[]; disabled: boolean; onChange: (value: string) => void;
  allowLocal?: boolean; localValue?: string; onLocal?: (value: string) => void;
  clearable?: boolean;
  hint?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const selected = options.find((option) => option.value === value)?.label || localValue || '';
  const matches = options.filter((option) => searchable(option.label).includes(searchable(query || '')));
  const visible = matches.slice(0, 80);
  const localChoice = allowLocal && !!query?.trim() && !options.some((option) => searchable(option.label) === searchable(query.trim()));
  const choices = [...visible, ...(localChoice ? [{ value: '__local__', label: `Propor “${query!.trim()}” como complemento local, sem código oficial` }] : [])];
  const close = () => { setOpen(false); setQuery(null); setActive(-1); };
  const choose = (option: SearchOption) => { if (option.value === '__local__') onLocal?.(query!.trim()); else onChange(option.value); close(); };

  useLayoutEffect(() => {
    if (!open || disabled) return;
    const place = () => {
      const bounds = input.current?.getBoundingClientRect();
      if (!bounds) return;
      const below = window.innerHeight - bounds.bottom - 12;
      const above = bounds.top - 12;
      const upwards = below < 160 && above > below;
      setPosition({ left: Math.max(8, bounds.left), width: Math.min(bounds.width, window.innerWidth - 16), ...(upwards ? { bottom: window.innerHeight - bounds.top + 4 } : { top: bounds.bottom + 4 }), maxHeight: Math.max(100, Math.min(320, upwards ? above : below)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, disabled]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => { if (open && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, open, id]);

  return <div className="field catalog-field" ref={container}>
    <div className="field-label-row"><label htmlFor={id}>{label}</label>{hint && <HelpTip label={`Ajuda: ${label}`} text={hint} />}</div>
    <div className="search-combobox">
      <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open && !disabled} aria-controls={open && !disabled ? `${id}-options` : undefined} aria-activedescendant={open && active >= 0 && choices[active] ? `${id}-option-${active}` : undefined} autoComplete="off" disabled={disabled} value={query === null ? selected : query} placeholder="Digite código ou descrição…" title={selected} onFocus={(event) => { setOpen(true); setActive(-1); event.currentTarget.select(); }} onClick={() => setOpen(true)} onBlur={close} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }} onKeyDown={(event) => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive((previous) => event.key === 'ArrowDown' ? Math.min(previous + 1, choices.length - 1) : previous < 0 ? choices.length - 1 : Math.max(0, previous - 1)); }
        if (event.key === 'Enter' && open) { event.preventDefault(); if (choices[active]) choose(choices[active]); else if (choices.length === 1) choose(choices[0]); }
      }} />
      {!!selected && !disabled && clearable && <button type="button" className="combobox-clear" aria-label={`Limpar ${label}`} onPointerDown={(event) => event.preventDefault()} onClick={() => { onChange(''); close(); }}><X size={14} /></button>}
      <ChevronDown className="combobox-chevron" size={15} aria-hidden="true" />
    </div>
    {open && !disabled && position && createPortal(<div ref={popup} className="combobox-popup" style={position}>
      <div id={`${id}-options`} role="listbox" aria-label={`Opções de ${label}`}>
        {choices.map((option, index) => <div id={`${id}-option-${index}`} key={option.value} role="option" aria-selected={option.value === value} className={`combobox-option${active === index ? ' active' : ''}${option.value === value ? ' selected' : ''}`} onPointerDown={(event) => event.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => choose(option)}>{option.label}</div>)}
      </div>
      {!choices.length && <p className="combobox-message" role="status">Nenhuma opção encontrada. O valor anterior será mantido até você selecionar ou limpar.</p>}
      {matches.length > visible.length && <p className="combobox-message">{visible.length} de {matches.length} opções. Continue digitando para refinar.</p>}
    </div>, document.body)}
  </div>;
}
