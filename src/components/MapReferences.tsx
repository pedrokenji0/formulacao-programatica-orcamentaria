import { useState } from 'react';
import { useApp } from '../store/AppStore';
import { Card, FormField, ActionButton } from './ui';
import { ExpandableText } from './CompactWorkspace';
import { mapComponents, stableLocalId, normalizeCode } from '../services/planningDomain';
import type { ProcessMap, MapItem } from '../types';
import { addActionItem, canAddActionItem } from '../services/mapDomain';
import { ActionItemLinks } from './ActionMapItems';
import { causeItems } from '../services/proposalDomain';

export function MapReferences({ map, updateMap, editable, section = 'todas', initialActionId }: { map: ProcessMap; updateMap: (apply: (target: ProcessMap) => void) => void; editable: boolean; section?: string; initialActionId?: string }) {
  const { state } = useApp();
  const program = state.programs.find((record) => record.id === map.programId)!;
  const actions = state.actions.filter((record) => record.programaId === map.programId);
  const [actionId, setActionId] = useState(initialActionId || actions.find((record) => normalizeCode(record.codigo) === '1082')?.id || actions[0]?.id || '');
  const [draftResult, setDraftResult] = useState('');
  const [resultKind, setResultKind] = useState<'resultados' | 'impactos'>('resultados');
  const action = actions.find((record) => record.id === actionId);
  const mappedAction = map.actions.find((record) => record.catalogActionId === actionId || record.id === actionId);
  const causes = causeItems(program);
  const components = mapComponents(map).filter((component) => ['atividade', 'produto'].includes(component.association.kind));
  const addCause = (cause: { id: string; texto: string }) => updateMap((target) => {
    target.causas ||= [];
    const existing = target.causas.find((item) => item.sourceReference === cause.id || item.texto === cause.texto);
    if (existing) { existing.texto = cause.texto; existing.sourceReference = cause.id; }
    else target.causas.push({ id: stableLocalId('causa'), texto: cause.texto, origin: 'confirmado', sourceReference: cause.id });
  });
  const confirm = (item: MapItem, section: 'causas' | 'contexto' | 'resultados' | 'impactos', action?: string) => updateMap((target) => {
    const items = action ? target.actions.find((record) => record.id === action)?.produtos || [] : target[section] || [];
    const record = items.find((candidate) => candidate.id === item.id);
    if (record) record.origin = 'confirmado';
  });
  return <>
    {section !== 'associacoes' && <Card title="Referências do cadastro e organização do mapa" lead="Importado: conteúdo cadastral do PPO. Sugestão: organização ainda não validada. Confirmado/complementado: decisão explícita da equipe.">
      <div className="map-origin-legend"><span className="badge blue">Importado</span><span className="badge orange">Sugestão de organização</span><span className="badge green">Confirmado pelo usuário</span><span className="badge purple">Complemento local</span></div>
      <div className="grid g2"><div className="map-reference-text"><b>Objetivo do programa — referência cadastral na proposta</b><ExpandableText text={program.objetivo} label="Objetivo do programa" /><b>Justificativa — referência para contexto</b><ExpandableText text={program.justificativa} label="Justificativa do programa" />
        <ActionButton sm color="ghost" disabled={!editable || !program.justificativa} onClick={() => updateMap((target) => { if (!target.contexto.some((item) => item.sourceReference === 'Justificativa do programa no PPO')) target.contexto.push({ id: stableLocalId('contexto'), texto: program.justificativa, origin: 'confirmado', sourceReference: 'Justificativa do programa no PPO' }); })}>Confirmar justificativa como contexto</ActionButton>
      </div><div>
        <label className="planning-selector">Ação de referência<select aria-label="Ação de referência do mapa" value={actionId} onChange={(event) => setActionId(event.target.value)}>{actions.map((record) => <option key={record.id} value={record.id}>{record.codigo} · UO {record.codigoUnidadeOrcamentaria} · {record.nome}</option>)}</select></label>
        <div className="map-reference-text"><b>Finalidade — referência do cadastro na proposta</b><ExpandableText text={action?.finalidade || ''} label="Finalidade da ação" /><b>Produto</b><ExpandableText text={action?.produto || ''} label="Produto da ação" /><b>Especificação do Produto</b><ExpandableText text={action?.especificacaoProduto || ''} label="Especificação do produto" /></div>
        {action?.local?.atividades.map((activity) => <div key={activity.id} className="reference-choice"><span className="badge purple">Atividade local</span><span>{activity.texto}</span><ActionButton sm disabled={!editable || !mappedAction || !canAddActionItem(mappedAction, 'atividades') || mappedAction.atividades.some((item) => item.sourceReference === activity.id)} onClick={() => updateMap((target) => { const record = target.actions.find((candidate) => candidate.id === mappedAction!.id)!; addActionItem(record, 'atividades', { id: stableLocalId('atividade-mapa'), texto: activity.texto, origin: 'confirmado', sourceReference: activity.id }); })}>Confirmar atividade no mapa</ActionButton></div>)}
        {!mappedAction && <p className="small muted">Vincule esta ação ao mapa na organização abaixo para incluir suas atividades.</p>}
      </div></div>
      <details><summary>Causas do programa — organização opcional</summary>{causes.map((cause) => <div key={cause.id} className="reference-choice"><span>{cause.texto}</span><ActionButton sm disabled={!editable || map.causas?.some((item) => item.texto === cause.texto)} onClick={() => addCause(cause)}>{map.causas?.some((item) => item.sourceReference === cause.id) ? 'Atualizar causa no mapa' : 'Confirmar causa no mapa'}</ActionButton></div>)}</details>
      <div className="map-result-draft"><span className="badge orange">Formulação pelo usuário</span><p>Objetivo e finalidade ajudam a formular resultados; não são convertidos automaticamente em resultados ou impactos confirmados.</p>
        <p className="small muted">Novo componente da ação {action?.codigo || 'não selecionada'} · UO {action?.codigoUnidadeOrcamentaria || 'local'}. Até 8 linhas por grupo e ação.</p>
        <FormField label="Resultado ou impacto proposto" textarea value={draftResult} disabled={!editable} onChange={setDraftResult} hint="Que situação se pretende alcançar, melhorar ou preservar?" />
        <div className="row"><select aria-label="Tipo do componente proposto" value={resultKind} onChange={(event) => setResultKind(event.target.value as typeof resultKind)}><option value="resultados">Resultado esperado</option><option value="impactos">Impacto</option></select><ActionButton disabled={!editable || !draftResult.trim() || !mappedAction || !canAddActionItem(mappedAction, resultKind)} onClick={() => { updateMap((target) => { const record = target.actions.find((candidate) => candidate.id === mappedAction?.id); if (record) addActionItem(record, resultKind, { id: stableLocalId(resultKind), texto: draftResult.trim(), origin: 'confirmado', sourceReference: 'Formulação confirmada pelo usuário' }); }); setDraftResult(''); }}>Confirmar e acrescentar ao mapa</ActionButton></div>
        {mappedAction && !canAddActionItem(mappedAction, resultKind) && <p role="status">Limite de 8 linhas atingido neste grupo da ação.</p>}
      </div>
    </Card>}
    {section !== 'referencias' && <Card title="Causas, atividades e produtos associados" lead="As relações abaixo são escolhas locais explícitas. Não pressupõem que todos os programas precisem de uma árvore causal.">
      {!map.causas?.length && <div className="empty">Nenhuma causa confirmada. Você pode organizar a cadeia operacional sem usar causas.</div>}
      {(map.causas || []).map((cause) => <div key={cause.id} className="cause-association"><b>{cause.texto}</b><div className="multi-pick">{components.map((component) => <label key={component.value}><input type="checkbox" disabled={!editable} checked={cause.associations?.some((association) => association.componentId === component.association.componentId) || false} onChange={(event) => updateMap((target) => { const record = target.causas!.find((candidate) => candidate.id === cause.id)!; record.associations = (record.associations || []).filter((association) => association.componentId !== component.association.componentId); if (event.target.checked) record.associations.push(component.association); })} />{component.label}</label>)}</div></div>)}
      {map.actions.filter((record) => !mappedAction || record.id === mappedAction.id).flatMap((record) => (['recursos', 'atividades'] as const).flatMap((key) => record[key].map((item) => <div className="cause-association" key={item.id}><b>{key === 'recursos' ? 'Recurso' : 'Atividade'} da ação {record.codigo} · UO {record.codigoUnidadeOrcamentaria || 'local'}: {item.texto}</b><ActionItemLinks action={record} item={item} section={key} editable={editable} updateMap={updateMap} /></div>)))}
      <details><summary>Proveniência e confirmação dos componentes</summary>
        {map.actions.flatMap((record) => record.produtos.map((item) => <div key={item.id} className="reference-choice"><span>{record.codigo} · {item.texto}</span><span className={`badge ${item.origin === 'confirmado' ? 'green' : 'blue'}`}>{item.origin === 'confirmado' ? 'Confirmado pelo usuário' : 'Referência de produto importada'}</span><ActionButton sm disabled={!editable || item.origin === 'confirmado'} onClick={() => confirm(item, 'contexto', record.id)}>Confirmar produto</ActionButton></div>))}
        {(['contexto', 'causas', 'resultados', 'impactos'] as const).flatMap((section) => (map[section] || []).map((item) => <div key={item.id} className="reference-choice"><span>{section} · {item.texto}</span><span className="badge green">{item.origin || 'Complemento local anterior'}</span></div>))}
      </details>
    </Card>}
  </>;
}
