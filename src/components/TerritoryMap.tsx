import { useId, useMemo, useRef, useState } from 'react';
import { Minus, Plus, LocateFixed } from 'lucide-react';
import { ActionButton } from './ui';
import { HelpTip } from './HelpTip';
import type { Regionalization, TerritoryDataset } from '../types';
import { regionBoundaryPaths } from '../services/territoryDomain';

export function TerritoryMap({ data, scheme, color, valueLabel, selected, onSelect, regionFilter, statewideLabel }: { data: TerritoryDataset; scheme?: Regionalization; color: (code: string) => string; valueLabel: (code: string) => string; selected: string; onSelect: (code: string) => void; regionFilter: string; statewideLabel?: string }) {
  const [view, setView] = useState({ x: 0, y: 0, w: data.width, h: data.height });
  const [hover, setHover] = useState('');
  const statewidePatternId = 'statewide-' + useId().replace(/:/g, '');
  const statewidePath = useMemo(() => data.municipalities.map((m) => m.path).join(' '), [data]);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; view: typeof view; moved: boolean } | null>(null);
  const moved = useRef(false);
  const boundaries = useMemo(() => regionBoundaryPaths(data, scheme), [data, scheme]);
  const active = data.municipalities.find((m) => m.code === (hover || selected));
  const zoom = (factor: number) => setView((current) => {
    const width = Math.max(data.width / 15, Math.min(data.width * 1.2, current.w * factor));
    const height = width * data.height / data.width;
    return { x: current.x + (current.w - width) / 2, y: current.y + (current.h - height) / 2, w: width, h: height };
  });
  const reset = () => setView({ x: 0, y: 0, w: data.width, h: data.height });
  const center = () => {
    const municipality = data.municipalities.find((m) => m.code === selected);
    if (!municipality) { reset(); return; }
    const [x1, y1, x2, y2] = municipality.bounds;
    const w = Math.max((x2 - x1) * 5, (y2 - y1) * 5 * data.width / data.height, 90), h = w * data.height / data.width;
    setView({ x: (x1 + x2 - w) / 2, y: (y1 + y2 - h) / 2, w, h });
  };
  return <div className="territory-canvas-wrap">
    <div className="territory-map-buttons" role="toolbar" aria-label="Navegação do mapa">
      <ActionButton sm color="ghost" aria-label="Ampliar mapa" onClick={() => zoom(0.7)}><Plus size={17} /></ActionButton>
      <ActionButton sm color="ghost" aria-label="Reduzir mapa" onClick={() => zoom(1 / 0.7)}><Minus size={17} /></ActionButton>
      <ActionButton sm color="ghost" onClick={reset}>Ver Minas Gerais</ActionButton>
      <ActionButton sm color="ghost" disabled={!selected} onClick={center}><LocateFixed size={16} />Localizar seleção</ActionButton><HelpTip label="Como navegar no mapa" text="Arraste para mover. Use + e − para ampliar ou reduzir, Home para enquadrar Minas Gerais e as setas do teclado para deslocar. Clique no município para consultar." />
    </div>
    <svg className="territory-canvas" role="group" aria-label="Mapa interativo dos 853 municípios de Minas Gerais" tabIndex={0} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      onKeyDown={(event) => {
        if (event.key === '+' || event.key === '=') { zoom(0.7); event.preventDefault(); }
        if (event.key === '-') { zoom(1 / 0.7); event.preventDefault(); }
        if (event.key === 'Home') { reset(); event.preventDefault(); }
        const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (delta) { setView((v) => ({ ...v, x: v.x + delta[0] * v.w / 12, y: v.y + delta[1] * v.h / 12 })); event.preventDefault(); }
      }}
      onPointerDown={(event) => { if (event.button !== 0) return; moved.current = false; drag.current = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, view, moved: false }; }}
      onPointerMove={(event) => {
        const origin = drag.current;
        if (!origin) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const dx = event.clientX - origin.x, dy = event.clientY - origin.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) { moved.current = true; event.currentTarget.setPointerCapture(event.pointerId); }
        if (moved.current) setView({ ...origin.view, x: origin.view.x - dx * origin.view.w / bounds.width, y: origin.view.y - dy * origin.view.h / bounds.height });
      }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onDoubleClick={() => zoom(0.7)}>
      <title>Minas Gerais: municípios e regionalizações</title>
      <defs><pattern id={statewidePatternId} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="9" stroke="#9b6a13" strokeWidth="2" opacity="0.5" /></pattern></defs>
      <g className="territory-municipalities">{data.municipalities.map((m) => <path key={m.code} data-code={m.code} className="territory-municipality" d={m.path} fill={color(m.code)} fillRule="evenodd" stroke={m.code === selected || m.code === hover ? '#102e41' : '#fff'} strokeWidth={m.code === selected || m.code === hover ? 1.8 : 0.5} vectorEffect="non-scaling-stroke" opacity={regionFilter && scheme?.memberships[m.code] !== regionFilter ? 0.18 : 1} role="button" aria-label={m.name + ' · IBGE ' + m.code} aria-pressed={selected === m.code} tabIndex={selected === m.code ? 0 : -1}
        onMouseEnter={() => setHover(m.code)} onMouseLeave={() => setHover('')} onClick={() => { if (!moved.current) onSelect(m.code); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { onSelect(m.code); event.preventDefault(); } }}>
        <title>{m.name} · {m.code} — {valueLabel(m.code)}{scheme ? ' · ' + (scheme.regions.find((region) => region.id === scheme.memberships[m.code])?.name || 'Sem região atribuída') : ''}</title>
      </path>)}</g>
      {statewideLabel && <g className="territory-statewide-coverage" role="img" aria-label={statewideLabel} pointerEvents="none"><title>{statewideLabel}</title><path d={statewidePath} fill={'url(#' + statewidePatternId + ')'} fillRule="evenodd" /></g>}
      <g className="territory-region-boundaries" pointerEvents="none" fill="none" stroke="#39596b" strokeWidth={1.2} vectorEffect="non-scaling-stroke">{boundaries.map((path, i) => <path key={i} d={path} vectorEffect="non-scaling-stroke" />)}</g>
      {selected && <path d={data.municipalities.find((m) => m.code === selected)?.path} fill="none" stroke="#112d40" strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
    </svg>
    <div className="territory-map-caption"><span>{active ? active.name + ' · ' + valueLabel(active.code) : 'Passe o cursor ou clique em um município'}</span></div>
  </div>;
}
