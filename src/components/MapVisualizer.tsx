import { ArrowRight } from 'lucide-react';
import type { ProcessMap } from '../types';

function Col({ label, items, weakIf, showPreProduct }: { label: string; items: { id: string; texto: string; preProduto?: string }[]; weakIf?: boolean; showPreProduct?: boolean }) {
  return (
    <div className="mcol">
      <div className="clabel">{label}</div>
      <div className={'mcard' + (items.length === 0 ? ' empty' : '')}>
        <h5>{label}</h5>
        <ul>
          {items.length === 0
            ? <li className="weak">— vazio —</li>
            : items.map((i) => <li key={i.id} className={weakIf ? 'weak' : ''}>{i.texto}{showPreProduct && i.preProduto && <span>Pré-produto: {i.preProduto}</span>}</li>)}
        </ul>
      </div>
    </div>
  );
}

const Arrow = () => <div className="marrow"><ArrowRight size={20} color="#22313c" /></div>;

export function MapVisualizer({ map, actionId, obzCount }: { map: ProcessMap; actionId?: string; obzCount?: Record<string, number> }) {
  const actions = actionId ? map.actions.filter((a) => a.id === actionId) : map.actions;
  return (
    <div>
      <div style={{ background: '#eef6fb', border: '1px solid #cfe7f4', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#27536b' }}>
        <b>PROBLEMA CENTRAL:</b> {map.problemaCentral || '—'}
      </div>
      {actions.map((a) => (
        <div key={a.id} style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 800, color: '#10202b', marginBottom: 8 }}>
            {a.codigo} — {a.nome}
            {obzCount && obzCount[a.id] != null && <span className="pill-count" style={{ marginLeft: 8 }}>{obzCount[a.id]} itens OBZ</span>}
          </div>
          <div className="mapflow">
            <Col label="CONTEXTO" items={map.contexto} />
            <Arrow />
            <Col label="PREMISSAS" items={map.premissas || []} />
            <Arrow />
            <Col label="RECURSOS" items={a.recursos} weakIf={a.recursos.length === 0} />
            <Arrow />
            <Col label="ATIVIDADES" items={a.atividades} weakIf={a.atividades.length === 0} showPreProduct />
            <Arrow />
            <Col label="PRODUTO PRINCIPAL" items={a.produtos} weakIf={a.produtos.length === 0} />
            <Arrow />
            <Col label="RESULTADOS" items={map.resultados} />
            <Arrow />
            <Col label="IMPACTOS" items={map.impactos} />
          </div>
        </div>
      ))}
      {actions.length === 0 && <div className="empty">Nenhuma ação no mapa.</div>}
    </div>
  );
}
