import { useState } from 'react';
import { ArrowRight, Pencil, EyeOff } from 'lucide-react';
import type { ProcessMap, MapItem } from '../types';
import { ExpandableText } from './CompactWorkspace';
import { principalProduct, secondaryProducts } from '../services/mapDomain';

export type MapSection = 'contexto' | 'premissas' | 'causas' | 'recursos' | 'atividades' | 'produtos' | 'produtoPrincipal' | 'produtosSecundarios' | 'resultados' | 'impactos' | 'pressupostos' | 'riscos' | 'identificacao';

function Column({ label, items, onEdit, showPreProduct = false }: { label: string; items: MapItem[]; onEdit?: () => void; showPreProduct?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 2);
  return <section className="mcol" aria-label={label}>
    <div className="clabel">{label} <span className="pill-count">{items.length}</span></div>
    <div className={`mcard${items.length ? '' : ' empty'}`}>
      {!items.length && <p className="map-empty">Nenhum item registrado.</p>}
      {visible.map((item, index) => <div key={item.id} className="map-node-item">
        <span className="map-line-number">Linha {index + 1}</span>
        <ExpandableText text={item.texto} label={`${label}: ${item.texto.slice(0, 35)}`} />
        <span className={'badge ' + (item.origin === 'importado' ? 'blue' : item.origin === 'sugestao' ? 'orange' : item.origin === 'confirmado' ? 'green' : 'purple')}>{item.origin === 'importado' ? 'Importado PPO' : item.origin === 'sugestao' ? 'Sugestão' : item.origin === 'confirmado' ? 'Confirmado' : 'Local'}</span>
        {showPreProduct && item.preProduto && <ExpandableText text={`Pré-produto: ${item.preProduto}`} label="Pré-produto" lines={2} />}
        {!!item.associations?.length && <span className="map-link-count">{item.associations.length} vínculo(s) confirmado(s)</span>}
      </div>)}
      {items.length > 2 && <button className="text-disclosure" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Ocultar itens' : `Ver mais ${items.length - 2} itens`}</button>}
      {onEdit && <button className="map-edit-node" type="button" aria-label={`Editar ${label.toLocaleLowerCase('pt-BR')}`} onClick={onEdit}><Pencil size={13} />{items.length ? 'Editar' : 'Adicionar'}</button>}
    </div>
  </section>;
}

export function MapVisualizer({ map, actionId, obzCount, onEdit }: { map: ProcessMap; actionId?: string; obzCount?: Record<string, number>; onEdit?: (section: MapSection, actionId?: string) => void }) {
  const [contextVisible, setContextVisible] = useState(true);
  const actions = actionId ? map.actions.filter((action) => action.id === actionId) : map.actions;
  const column = (label: string, section: MapSection, items: MapItem[], action?: string) => <Column label={label} items={items} onEdit={onEdit ? () => onEdit(section, action) : undefined} showPreProduct={section === 'atividades'} />;
  return <div className="integrated-map-canvas">
    <div className="map-program-strip"><div><b>Problema ou necessidade de atuação</b><ExpandableText text={map.problemaCentral || 'Ainda não informado pela equipe.'} label="Problema ou necessidade" lines={2} /></div>{onEdit && <button type="button" className="map-edit-node" onClick={() => onEdit('identificacao')}>Editar programa</button>}<button type="button" className="text-disclosure" onClick={() => setContextVisible(!contextVisible)} aria-expanded={contextVisible}><EyeOff size={13} /> {contextVisible ? 'Ocultar contexto e premissas' : 'Mostrar contexto e premissas'}</button></div>
    {contextVisible && <div className="map-shared-context">
      {column('Contexto', 'contexto', map.contexto)}
      {column('Premissas', 'premissas', map.premissas || [])}
      {!!map.causas?.length && column('Causas', 'causas', map.causas)}
    </div>}
    {actions.map((action) => <section key={action.id} className="map-action-lane">
      <div className="map-action-title"><div><strong>Ação {action.codigo || 'local'} · UO {action.codigoUnidadeOrcamentaria || 'não informada'}</strong><ExpandableText text={action.nome} label={`Nome da ação ${action.codigo}`} lines={2} /></div>{onEdit && <button type="button" className="map-edit-node" onClick={() => onEdit('identificacao', action.id)}>Editar ação</button>}{obzCount && <span className="pill-count">{obzCount[action.id] || 0} itens OBZ</span>}</div>
      <div className="mapflow" tabIndex={0} role="region" aria-label={`Cadeia da ação ${action.codigo}`}>
        {(['recursos', 'atividades', 'produtos', 'resultados', 'impactos'] as const).map((section, index) => <div className="map-flow-step" key={section}>
          {index > 0 && <div className="marrow"><ArrowRight size={19} /></div>}
          {section === 'produtos' ? <div className="map-products-stack">
            {column('Produto principal', 'produtoPrincipal', principalProduct(action) ? [principalProduct(action)!] : [], action.id)}
            {column('Entregas secundárias', 'produtosSecundarios', secondaryProducts(action), action.id)}
          </div> : column(({ recursos: 'Recursos', atividades: 'Atividades', resultados: 'Resultados', impactos: 'Impactos' })[section], section, action[section] || [], action.id)}
        </div>)}
      </div>
    </section>)}
    {(map.resultados.length > 0 || map.impactos.length > 0) && <section className="map-legacy-outcomes"><h3>Resultados e impactos compartilhados do programa</h3><p className="small muted">Registros anteriores preservados no âmbito do programa, sem atribuição automática às ações.</p><div className="map-shared-context">{column('Resultados do programa', 'resultados', map.resultados)}{column('Impactos do programa', 'impactos', map.impactos)}</div></section>}
    {!actions.length && <div className="empty">Nenhuma ação no mapa. Vincule uma ação para organizar sua cadeia.</div>}
  </div>;
}
