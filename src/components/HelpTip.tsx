import { createContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const CompactHelpContext = createContext(false);

export function HelpTip({ label, children, text }: { label: string; children?: ReactNode; text: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const show = () => { clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = setTimeout(() => setOpen(false), 150); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const bounds = trigger.current?.getBoundingClientRect();
      if (!bounds) return;
      const width = Math.min(320, window.innerWidth - 24);
      const above = window.innerHeight - bounds.bottom < 170 && bounds.top > 170;
      setPosition({ width, left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)), ...(above ? { bottom: window.innerHeight - bounds.top + 6 } : { top: bounds.bottom + 6 }) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } };
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !bubble.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('keydown', escape, true);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', escape, true); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <>
    <button ref={trigger} type="button" className={children ? 'help-tip detail-tip' : 'help-tip'} aria-label={label} aria-describedby={open ? id : undefined} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={() => setOpen(false)} onClick={show}>{children || '?'}</button>
    {open && createPortal(<div ref={bubble} id={id} role="tooltip" className="help-bubble" style={position} onMouseEnter={show} onMouseLeave={hide}>{text}</div>, document.body)}
  </>;
}
