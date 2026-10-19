import { useState } from 'react';
import { useApp } from '../../store/AppStore';
import { ActionButton, Card, FormField, Modal, Tabs, useToast } from '../../components/ui';
import { originalProjectMap } from '../../services/projectMapReference';
import { COMPONENT_LABELS, CHAIN_STAGES, canEditProjectMap, editableProjectMap, projectMapDifferences, projectMapsForProgram, projectMapForAction, restoreProjectMap, restoreProjectRecord, removeProjectRecord } from '../../services/projectMapDomain';
import type { MapDocumentSource, ProjectPlanningMap, ProjectComponent, ProjectComponentKind, ProjectIndicator, IndicatorStage } from '../../types';

export function ProjectMapLinks({ programId, actionId, onOpen }: { programId: string; actionId?: string; onOpen?: (id: string) => void }) {
  const { state } = useApp();
  const maps = actionId ? [projectMapForAction(state, actionId)].filter((map): map is ProjectPlanningMap => !!map) : projectMapsForProgram(state, programId);
  if (!maps.length || !onOpen) return null;
  return <div className="project-map-links">{maps.map((map) => <ActionButton key={map.id} sm color="ghost" onClick={() => onOpen(map.id)}>Abrir MaPR e indicadores — {map.projectName} · projeto {map.projectCode}</ActionButton>)}</div>;
}

function SourceNote({ source }: { source: MapDocumentSource | null }) {
  return <span className={`badge ${source ? 'blue' : 'purple'}`}>{source ? `Avaliação ${source.year} · figura ${source.figure} · p. ${source.printedPage}` : 'Rascunho local'}</span>;
}
const recordOrder = (left: { order: number }, right: { order: number }) => left.order - right.order;
const showEditor = () => requestAnimationFrame(() => document.getElementById('project-map-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

export function ProjectMapWorkspace({ map }: { map: ProjectPlanningMap }) {
  const { state, update, saveNow } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<'mapr' | 'indicadores'>('mapr');
  const [view, setView] = useState<'mapr' | 'indicadores'>('mapr');
  const [readOriginal, setReadOriginal] = useState(false);
  const [comparison, setComparison] = useState(false);
  const [restore, setRestore] = useState<'mapr' | 'indicadores' | null>(null);
  const [selection, setSelection] = useState('');
  const [removeId, setRemoveId] = useState('');
  const original = originalProjectMap(map);
  const visible = readOriginal ? original : map;
  const allowed = canEditProjectMap(state, map);
  const editable = allowed && !readOriginal;
  const changes = projectMapDifferences(map);
  const maprChanged = projectMapDifferences(map, 'mapr').length > 0;
  const indicatorsChanged = projectMapDifferences(map, 'indicadores').length > 0;
  const component = visible.components.find((item) => item.id === selection);
  const indicator = visible.indicators.find((item) => item.id === selection);
  const owner = state.programs.find((program) => program.id === map.ownerProgramId);
  const actions = map.actionIds.map((id) => state.actions.find((action) => action.id === id)).filter((action) => !!action);
  const change = (apply: (target: ProjectPlanningMap) => void) => update((draft) => apply(editableProjectMap(draft, map.id)));
  const select = (id: string, kind: 'mapr' | 'indicadores' = 'mapr') => { setTab(kind); setSelection(id); showEditor(); };
  const addComponent = (kind: ProjectComponentKind) => {
    const id = `componente-local-${crypto.randomUUID()}`;
    change((target) => target.components.push({ id, kind, order: Math.max(0, ...target.components.filter((item) => item.kind === kind).map((item) => item.order)) + 1, text: '', origin: 'local', source: null, actionIds: [] }));
    select(id);
  };
  const addIndicator = (stage: IndicatorStage) => {
    const id = `indicador-projeto-local-${crypto.randomUUID()}`;
    change((target) => target.indicators.push({ id, name: '', stage, order: Math.max(0, ...target.indicators.map((item) => item.order)) + 1, officialCode: '', formula: '', unit: '', frequency: '', polarity: '', definition: '', dataSource: '', geography: '', referenceIndex: '', referenceDate: '', origin: 'local', source: null, links: [] }));
    select(id, 'indicadores');
  };
  const setComponent = (apply: (record: ProjectComponent) => void) => change((target) => apply(target.components.find((item) => item.id === selection)!));
  const setIndicator = (apply: (record: ProjectIndicator) => void) => change((target) => apply(target.indicators.find((item) => item.id === selection)!));
  const toolbar = <div className="row project-map-operations">
    <span className={`badge ${changes.length ? 'orange' : 'blue'}`}>{changes.length ? 'Alterado na proposta' : 'Original preservado'}</span>
    <span className={`badge ${editable ? 'green' : 'gray'}`}>{readOriginal ? 'Referência somente leitura' : allowed ? 'Editável na proposta' : 'Somente consulta'}</span>
    <ActionButton sm disabled={!editable} onClick={async () => { try { await saveNow(); toast('Proposta do mapa salva neste navegador.', 'ok'); } catch { toast('Falha ao salvar. Confira o aviso no cabeçalho.', 'err'); } }}>Salvar proposta do mapa</ActionButton>
    <ActionButton sm color="ghost" onClick={() => { setReadOriginal(!readOriginal); setSelection(''); }}>{readOriginal ? 'Voltar à proposta' : 'Ver original'}</ActionButton>
    <ActionButton sm color="ghost" onClick={() => setComparison(true)}>Comparar com o original</ActionButton>
    <ActionButton sm color="ghost" disabled={!editable || !maprChanged} onClick={() => setRestore('mapr')}>Reverter MaPR para o original</ActionButton>
    <ActionButton sm color="ghost" disabled={!editable || !indicatorsChanged} onClick={() => setRestore('indicadores')}>Reverter indicadores para o original</ActionButton>
  </div>;
  return <div className="ppo-sheet project-map-workspace" data-map-id={map.id}>
    <Card title={`${map.projectName} · projeto estratégico ${map.projectCode}`}>
      <div className="project-map-summary"><span>Um mapa compartilhado · {visible.components.length} componentes · {visible.indicators.length} indicadores</span><details><summary>Origem e ações participantes</summary>
        <p>MaPR: figura 2, p. 8. Indicadores: figura 3, p. 9. Avaliação publicada em 2025; mapas discutidos em 2024. As ações são da referência PPO {state.planning?.exercise}.</p>
        <ul>{actions.map((action) => <li key={action.id}>Ação {action.codigo} · UO {action.codigoUnidadeOrcamentaria} · {action.nome}</li>)}</ul>
        <p>A participação no projeto não atribui automaticamente cada componente a todas as ações. A edição compartilhada segue a permissão do programa {owner?.codigo}, UO {owner?.codigoUnidadeOrcamentaria || 'não informada'}, como regra deste mockup.</p>
      </details></div>
      <Tabs tabs={[{ id: 'mapr', label: 'MaPR — Processos e Resultados' }, { id: 'indicadores', label: 'Mapa de Indicadores' }]} active={view} onChange={(value) => { setView(value as typeof view); setTab(value as typeof tab); setSelection(''); }} />
      {toolbar}
      {readOriginal && <p className="alert info">Você está consultando o original da avaliação. Suas alterações continuam na proposta.</p>}
      {view === 'mapr' ? <>
      <p className="small muted">Mapa de Processos e Resultados da avaliação do Minas Reurb — 37 componentes compartilhados entre as ações do projeto.</p>
      <details className="reference-panel" open><summary>Contexto e pressupostos ({visible.components.filter((item) => item.kind === 'contexto' || item.kind === 'pressuposto').length})</summary><div className="project-map-context">{(['contexto', 'pressuposto'] as const).map((kind) => <ComponentColumn key={kind} kind={kind} items={visible.components.filter((item) => item.kind === kind)} originals={original.components} editable={editable} onSelect={select} onAdd={() => addComponent(kind)} />)}</div></details>
      <div className="project-map-chain" role="region" aria-label="MaPR do projeto" tabIndex={0}>{CHAIN_STAGES.map((kind) => <ComponentColumn key={kind} kind={kind} items={visible.components.filter((item) => item.kind === kind)} originals={original.components} editable={editable} onSelect={select} onAdd={() => addComponent(kind)} />)}</div>
      </> : <>
      <p className="small muted">12 indicadores da figura 3 da avaliação. Fórmulas e medições não informadas permanecem vazias; vínculos sugeridos dependem de confirmação.</p>
      <div className="project-map-chain" role="region" aria-label="Mapa de indicadores do projeto" tabIndex={0}>{CHAIN_STAGES.map((stage) => <section className="project-map-column" key={stage}><h3>{COMPONENT_LABELS[stage]} <span className="pill-count">{visible.indicators.filter((item) => item.stage === stage).length}</span></h3>{visible.indicators.filter((item) => item.stage === stage).sort(recordOrder).map((item) => <article className="project-map-node indicator-node" key={item.id}>
        <p>{item.name || 'Indicador em rascunho'}</p><SourceNote source={item.source} /><p className="small muted">{item.links.filter((link) => link.status === 'confirmado').length} vínculos confirmados</p>
        <ActionButton sm color="ghost" onClick={() => select(item.id, 'indicadores')} aria-label={`Abrir indicador ${item.name || 'em rascunho'}`}>{editable ? 'Editar ficha' : 'Consultar ficha'}</ActionButton>
      </article>)}<ActionButton sm color="ghost" disabled={!editable} onClick={() => addIndicator(stage)}>Rascunhar indicador — {COMPONENT_LABELS[stage]}</ActionButton></section>)}</div>
      </>}
      {selection && <fieldset className="sheet-inline-editor project-map-editor" id="project-map-editor"><legend>{tab === 'mapr' ? 'Ficha do componente' : 'Ficha do indicador'}</legend>
        {component && tab === 'mapr' && <>
          <div className="grid g2"><FormField label="Identificador do componente" value={component.id} disabled /><FormField label="Origem do componente" value={component.source ? `${component.source.title} · ${component.source.year}` : 'Rascunho local'} disabled /></div>
          <FormField label="Texto do componente" textarea value={component.text} disabled={!editable} onChange={(value) => setComponent((item) => { item.text = value; })} />
          <label className="field">Tipo de componente<select aria-label="Tipo de componente" value={component.kind} disabled={!editable} onChange={(event) => setComponent((item) => { item.kind = event.target.value as ProjectComponentKind; })}>{Object.entries(COMPONENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <fieldset><legend>Participação das ações neste componente</legend><p className="small muted">Associação explícita, opcional. O componente continua único no projeto.</p>{actions.map((action) => <label className="project-map-check" key={action.id}><input type="checkbox" checked={component.actionIds.includes(action.id)} disabled={!editable} onChange={(event) => setComponent((item) => { item.actionIds = item.actionIds.filter((id) => id !== action.id); if (event.target.checked) item.actionIds.push(action.id); })} />{action.codigo} · UO {action.codigoUnidadeOrcamentaria} · {action.nome}</label>)}</fieldset>
          {original.components.some((item) => item.id === component.id) && <details className="reference-panel"><summary>Texto original da avaliação</summary><p>{original.components.find((item) => item.id === component.id)!.text}</p></details>}
        </>}
        {indicator && tab === 'indicadores' && <>
          <div className="grid g2"><FormField label="Identificador do indicador" value={indicator.id} disabled /><FormField label="Código oficial PPO do indicador" value={indicator.officialCode} disabled hint="O relatório não informa código oficial." /></div>
          <SourceNote source={indicator.source} />
          <FormField label="Nome do indicador" textarea value={indicator.name} disabled={!editable} onChange={(value) => setIndicator((item) => { item.name = value; })} />
          <label className="field">Etapa acompanhada<select aria-label="Etapa acompanhada" value={indicator.stage} disabled={!editable} onChange={(event) => setIndicator((item) => { item.stage = event.target.value as IndicatorStage; })}>{CHAIN_STAGES.map((stage) => <option key={stage} value={stage}>{COMPONENT_LABELS[stage]}</option>)}</select></label>
          <div className="grid g2">{([['definition', 'Definição operacional'], ['formula', 'Fórmula de cálculo'], ['unit', 'Unidade de medida'], ['frequency', 'Periodicidade da coleta'], ['polarity', 'Polaridade'], ['dataSource', 'Fonte dos dados de medição'], ['geography', 'Base geográfica'], ['referenceIndex', 'Índice de referência'], ['referenceDate', 'Data de apuração']] as const).map(([field, label]) => <FormField key={field} label={label} value={indicator[field]} textarea={['definition', 'formula', 'dataSource'].includes(field)} disabled={!editable} onChange={(value) => setIndicator((item) => { item[field] = value; })} />)}</div>
          <fieldset><legend>Componentes acompanhados no MaPR</legend><p className="small muted">Marque para confirmar uma associação. Sugestões não contam como vínculos confirmados.</p>
            {visible.components.filter((item) => CHAIN_STAGES.includes(item.kind as IndicatorStage)).map((item) => {
              const link = indicator.links.find((record) => record.componentId === item.id);
              return <label className="project-map-check" key={item.id}><input type="checkbox" checked={link?.status === 'confirmado'} disabled={!editable} onChange={(event) => setIndicator((record) => {
                record.links = record.links.filter((candidate) => candidate.componentId !== item.id);
                if (event.target.checked) record.links.push({ componentId: item.id, status: 'confirmado' });
                else if (original.indicators.find((candidate) => candidate.id === indicator.id)?.links.some((candidate) => candidate.componentId === item.id)) record.links.push({ componentId: item.id, status: 'sugerido' });
              })} /><span>{COMPONENT_LABELS[item.kind]} · {item.text || 'Componente sem texto'}{link?.status === 'sugerido' && <small className="badge orange">Sugestão — não confirmada</small>}</span></label>;
            })}
            {indicator.links.filter((link) => !visible.components.some((item) => item.id === link.componentId)).map((link) => <p className="alert warn" key={link.componentId}>Componente removido da proposta: {link.componentId}. Revise a associação ou restaure o MaPR.</p>)}
          </fieldset>
          {original.indicators.some((item) => item.id === indicator.id) && <details className="reference-panel"><summary>Ficha original da avaliação</summary><p>{original.indicators.find((item) => item.id === indicator.id)!.name}</p><p>Fórmula, unidade, periodicidade, linha de base e valores não informados na figura permanecem vazios no original.</p></details>}
        </>}
        <div className="row">
          <ActionButton sm color="ghost" onClick={() => setSelection('')}>Concluir ficha</ActionButton>
          {(tab === 'mapr' ? original.components : original.indicators).some((item) => item.id === selection) && <ActionButton sm color="ghost" disabled={!editable} onClick={() => update((draft) => restoreProjectRecord(draft, map.id, tab === 'mapr' ? 'componente' : 'indicador', selection))}>Reverter este {tab === 'mapr' ? 'componente' : 'indicador'} para o original</ActionButton>}
          <ActionButton sm color="ghost" disabled={!editable} onClick={() => setRemoveId(selection)}>Remover da proposta</ActionButton>
        </div>
      </fieldset>}
    </Card>
    {comparison && <Modal wide title="Comparação — MaPR e indicadores" onClose={() => setComparison(false)}>{!changes.length ? <p>A proposta mantém o original da avaliação.</p> : <div className="table-wrap"><table className="dt revision-table"><thead><tr><th>Campo</th><th>Original da avaliação</th><th>Proposta local</th></tr></thead><tbody>{changes.map((change) => <tr key={change.field}><th>{change.field}</th><td><pre className="preserve-text">{change.before}</pre></td><td><pre className="preserve-text">{change.after}</pre></td></tr>)}</tbody></table></div>}</Modal>}
    {restore && <Modal title={`Reverter ${restore === 'mapr' ? 'MaPR' : 'indicadores'}?`} onClose={() => setRestore(null)}><p>Restaurar este conjunto de dados conforme a avaliação de 2025? A operação ficará no histórico.</p><p>{restore === 'mapr' ? 'As fichas dos indicadores continuam preservadas. Vínculos a componentes locais removidos serão sinalizados.' : 'Os componentes e textos do MaPR continuam preservados.'}</p><ActionButton disabled={!editable} onClick={() => { update((draft) => restoreProjectMap(draft, map.id, restore)); setSelection(''); setRestore(null); }}>Confirmar reversão</ActionButton></Modal>}
    {removeId && <Modal title="Remover da proposta?" onClose={() => setRemoveId('')}><p>O registro será preservado no histórico. O original da avaliação continuará disponível.</p><ActionButton disabled={!editable} color="red" onClick={() => { update((draft) => removeProjectRecord(draft, map.id, tab === 'mapr' ? 'componente' : 'indicador', removeId)); setSelection(''); setRemoveId(''); }}>Confirmar remoção da proposta</ActionButton></Modal>}
  </div>;
}

function ComponentColumn({ kind, items, originals, editable, onSelect, onAdd, indicators, allIndicators = [], onSelectIndicator, onAddIndicator }: {
  kind: ProjectComponentKind; items: ProjectComponent[]; originals: ProjectComponent[]; editable: boolean;
  onSelect: (id: string) => void; onAdd: () => void; indicators?: ProjectIndicator[]; allIndicators?: ProjectIndicator[];
  onSelectIndicator?: (id: string) => void; onAddIndicator?: () => void;
}) {
  return <section className="project-map-column" aria-label={COMPONENT_LABELS[kind]}><h3>{COMPONENT_LABELS[kind]} <span className="pill-count">{items.length}</span></h3>{items.sort(recordOrder).map((item) => <article className="project-map-node" key={item.id}>
    <p>{item.text || 'Componente em rascunho'}</p><SourceNote source={item.source} />
    {originals.some((original) => original.id === item.id && (original.text !== item.text || original.kind !== item.kind)) && <span className="badge orange">Alterado</span>}
    {!!item.actionIds.length && <p className="small muted">{item.actionIds.length} ações associadas explicitamente</p>}
    {allIndicators.filter((indicator) => indicator.links.some((link) => link.componentId === item.id && link.status === 'confirmado')).map((indicator) => <button className="project-linked-indicator" key={indicator.id} onClick={() => onSelectIndicator?.(indicator.id)}>Indicador: {indicator.name || 'Rascunho'}</button>)}
    <ActionButton sm color="ghost" onClick={() => onSelect(item.id)} aria-label={`Abrir componente ${item.text || 'em rascunho'}`}>{editable ? 'Editar' : 'Consultar'}</ActionButton>
  </article>)}{!items.length && <p className="small muted">Nenhum componente registrado.</p>}<ActionButton sm color="ghost" disabled={!editable} onClick={onAdd}>Adicionar {COMPONENT_LABELS[kind].toLocaleLowerCase('pt-BR')}</ActionButton>
    {indicators && <div className="project-indicators-inline"><h4>Indicadores de {COMPONENT_LABELS[kind].toLocaleLowerCase('pt-BR')} <span className="pill-count">{indicators.length}</span></h4>{indicators.sort(recordOrder).map((item) => <article className="project-map-node indicator-node" key={item.id}>
      <p>{item.name || 'Indicador em rascunho'}</p><SourceNote source={item.source} /><p className="small muted">{item.links.filter((link) => link.status === 'confirmado').length} vínculos confirmados</p>
      <ActionButton sm color="ghost" onClick={() => onSelectIndicator?.(item.id)} aria-label={`Abrir indicador ${item.name || 'em rascunho'}`}>{editable ? 'Editar ficha' : 'Consultar ficha'}</ActionButton>
    </article>)}<ActionButton sm color="ghost" disabled={!editable} onClick={onAddIndicator}>Rascunhar indicador — {COMPONENT_LABELS[kind]}</ActionButton></div>}
  </section>;
}
