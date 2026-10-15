import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Status } from '../types';
import { STATUS_COLOR } from '../store/AppStore';
import { CompactHelpContext, HelpTip } from './HelpTip';

// ---- Card ----
export function Card({ title, scope, count, actions, children, lead, invalid }: {
  title?: React.ReactNode; scope?: 'PROGRAMA' | 'AÇÃO'; count?: number;
  actions?: React.ReactNode; children: React.ReactNode; lead?: React.ReactNode; invalid?: boolean;
}) {
  const compact = useContext(CompactHelpContext);
  return (
    <div className={'card' + (invalid ? ' invalid' : '')}>
      {(title || actions) && (
        <div className="section-actions">
          <div>
            {title && <div className="card-heading"><h2>{title}
              {scope && <span className={'badge ' + (scope === 'PROGRAMA' ? 'blue' : 'purple')}>{scope}</span>}
              {count != null && <span className="pill-count">{count}</span>}
            </h2>{compact && lead && <HelpTip label="Ajuda desta seção" text={lead} />}</div>}
            {lead && !compact && <p className="lead">{lead}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ---- Tabs ----
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={'tab' + (active === t.id ? ' on' : '')} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

// ---- ActionButton ----
type Color = 'green' | 'blue' | 'red' | 'orange' | 'purple' | 'gray' | 'ghost';
export function ActionButton({ color = 'blue', icon, children, sm, ...rest }: {
  color?: Color; icon?: React.ReactNode; sm?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`btn ${color}${sm ? ' sm' : ''}`} {...rest}>{icon}{children}</button>;
}

// ---- StatusBadge ----
export function StatusBadge({ status }: { status: Status }) {
  return <span className={'badge ' + STATUS_COLOR[status]}>{status}</span>;
}

// ---- FormField ----
export function FormField({ label, required, hint, value, onChange, textarea, type = 'text', disabled, placeholder, maxLength }: {
  label: string; required?: boolean; hint?: string; value: string | number;
  onChange?: (v: string) => void; textarea?: boolean; type?: string; disabled?: boolean; placeholder?: string; maxLength?: number;
}) {
  const compact = useContext(CompactHelpContext);
  return (
    <div className="field">
      <div className="field-label-row"><label>{label}{required && <span className="req"> *</span>}</label>{compact && hint && <HelpTip label={`Ajuda: ${label}`} text={hint} />}</div>
      {textarea
        ? <textarea aria-label={label} value={value} disabled={disabled} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange?.(e.target.value)} />
        : <input aria-label={label} type={type} value={value} disabled={disabled} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange?.(e.target.value)} />}
      {hint && !compact && <span className="hint">{hint}</span>}
    </div>
  );
}

// ---- SelectField ----
export function SelectField({ label, required, value, options, onChange, disabled, placeholder = '— selecione —' }: {
  label: string; required?: boolean; value: string; options: string[]; onChange?: (v: string) => void; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div className="field">
      <label>{label}{required && <span className="req"> *</span>}</label>
      <div className="select-wrap">
        <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="sbtn">▾</span>
      </div>
    </div>
  );
}

// ---- Chip list ----
export function ChipList({ items, onRemove, render }: {
  items: { id: string; texto: string; categoria?: string; publicos?: string[] }[];
  onRemove?: (id: string) => void; render?: (i: any) => React.ReactNode;
}) {
  if (!items.length) return <div className="chips empty-state">Nenhum item adicionado.</div>;
  return (
    <div className="chips">
      {items.map((i) => (
        <span className="chip" key={i.id}>
          {i.categoria && <span className="ctag">{i.categoria}</span>}
          <span>{render ? render(i) : i.texto}</span>
          {i.publicos?.map((p) => <span className="ctag" key={p}>{p}</span>)}
          {onRemove && <button className="x" onClick={() => onRemove(i.id)} title="Remover">⊗</button>}
        </span>
      ))}
    </div>
  );
}

// ---- Modal ----
export function Modal({ title, sub, onClose, children, foot, wide }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode; wide?: boolean;
}) {
  const compact = useContext(CompactHelpContext);
  const container = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    container.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== container.current) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key === 'Tab') {
        const controls = Array.from(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') || []).filter((element) => element.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === container.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, []);
  return createPortal(
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${compact ? ' qualitative-dialog' : ''}`} ref={container} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={wide ? { maxWidth: 1040 } : undefined}>
        <div className="modal-head">
          <div><h3 id={titleId}>{title}</h3>{sub && <div style={{ fontSize: 11.5, opacity: .8 }}>{sub}</div>}</div>
          <button className="x" aria-label="Fechar janela" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>, document.body
  );
}

// ---- Stat ----
export function Stat({ k, v, color }: { k: string; v: React.ReactNode; color?: 'green' | 'orange' | 'blue' }) {
  return <div className="stat"><div className="k">{k}</div><div className={'v ' + (color || '')}>{v}</div></div>;
}

// ---- Toast ----
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<{ msg: string; kind?: string } | null>(null);
  const show = useCallback((msg: string, kind?: 'ok' | 'err') => {
    setT({ msg, kind }); setTimeout(() => setT(null), 4200);
  }, []);
  return <ToastCtx.Provider value={show}>{children}{t && <div className={'toast ' + (t.kind || '')}>{t.msg}</div>}</ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

export const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const uid = (p = 'id') => p + '-' + Math.random().toString(36).slice(2, 9);
