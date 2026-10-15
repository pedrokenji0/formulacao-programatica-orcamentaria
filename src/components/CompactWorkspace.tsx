import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

export function ExpandableText({ text, label = 'texto', lines = 3 }: { text: string; label?: string; lines?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const content = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const measure = () => { if (content.current && !expanded) setOverflowing(content.current.scrollHeight > content.current.clientHeight + 1); };
    measure();
    const observer = new ResizeObserver(measure);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, [text, expanded, lines]);
  return <div className="expandable-text"><p ref={content} className={expanded ? 'expanded' : 'clamped'} style={{ WebkitLineClamp: expanded ? undefined : lines }}>{text || 'Não informado'}</p>
    {(overflowing || expanded) && <button type="button" className="text-disclosure" aria-expanded={expanded} aria-label={`${expanded ? 'Ver menos' : 'Ver mais'}: ${label}`} onClick={() => setExpanded(!expanded)}>{expanded ? 'Ver menos' : 'Ver mais'}</button>}
  </div>;
}

export function SectionTile({ title, description, preview, onOpen, count }: { title: string; description?: string; preview?: string; onOpen: () => void; count?: number }) {
  return <button type="button" className="section-tile" onClick={onOpen} aria-label={`Abrir ${title}`}>
    <span className="section-tile-heading"><strong>{title}</strong><ArrowUpRight size={18} /></span>
    {description && <span className="section-tile-description">{description}</span>}
    {preview && <span className="section-tile-preview">{preview}</span>}
    <span className="section-tile-footer">Abrir janela {count != null && <span className="pill-count">{count}</span>}</span>
  </button>;
}
