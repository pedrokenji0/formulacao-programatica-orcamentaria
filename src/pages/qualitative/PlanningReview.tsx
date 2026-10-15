import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppStore';
import type { Program, MapItem } from '../../types';
import { Card, FormField, ActionButton, Tabs, Modal } from '../../components/ui';
import { SectionTile } from '../../components/CompactWorkspace';
import { changedFields, indicatorsFor, associationValue, mapComponents } from '../../services/planningDomain';
import { principalProduct } from '../../services/mapDomain';
import { HelpTip } from '../../components/HelpTip';
import { canEditRecord, indicatorPending } from '../../services/editingPolicy';
import { programPending, actionPending } from '../../services/proposalDomain';

interface Difference { field: string; before: string; after: string }
interface Revision { id: string; title: string; differences: Difference[] }
const text = (value: unknown) => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2);
const valueChange = (field: string, before: unknown, after: unknown): Difference[] => text(before) === text(after) ? [] : [{ field, before: text(before), after: text(after) }];
export function PlanningReview({ program }: { program: Program }) {
  const [tab, setTab] = useState('alteracoes');
  const [selected, setSelected] = useState('');
  const { state, reference, update, can, persistenceMessage } = useApp();
  const editable = can('editMarcoLogico') || can('editMapa');
  const baselineLocalizers = useMemo(() => new Map(reference.localizers.map((record) => [record.id, record])), [reference]);
  const requests = (state.planning?.associationRequests || []).filter((request) => request.entityId === program.id || state.actions.some((action) => action.id === request.entityId && action.programaId === program.id));
  const revisions: Revision[] = [];
  const currentMap = state.maps.find((map) => map.programId === program.id);
  const components = mapComponents(currentMap);
  const originalProgram = reference.programs.find((record) => record.id === program.id);
  const programChanges = [...changedFields(originalProgram?.officialFields || {}, program.officialFields || {}), ...valueChange('Alinhamento estratégico', originalProgram?.strategicLinks || [], program.strategicLinks || []), ...valueChange('Campos PPO ausentes da exportação (complementos locais)', originalProgram?.ppoComplements || {}, program.ppoComplements || {})];
  if (!originalProgram) programChanges.unshift({ field: 'Inclusão proposta', before: 'Sem cadastro importado de referência', after: 'Novo programa em rascunho local. Campos oficiais de situação não presumidos.' });
  if (programChanges.length) revisions.push({ id: program.id, title: `Programa ${program.codigo || 'Sem código oficial'}`, differences: programChanges });
  for (const action of state.actions.filter((record) => record.programaId === program.id)) {
    const original = reference.actions.find((record) => record.id === action.id);
    const differences = [...changedFields(original?.officialFields || {}, action.officialFields || {}), ...valueChange('Detalhamento da Implementação (local)', original?.detalhamentoImplementacao || '', action.detalhamentoImplementacao || '')];
    const labels: Record<string, string> = { atividades: 'Atividades principais (local)', criterioEntrega: 'Critério de entrega (local)', evidenciaEntrega: 'Evidência de entrega (local)', parceirosCondicoes: 'Parceiros e condições (local)', distribuicaoTerritorial: 'Distribuição territorial (local)', papelLocalizador: 'Papel da referência territorial (local)', criteriosTerritoriais: 'Critérios territoriais (local)', condicoesTerritoriais: 'Condições territoriais (local)' };
    labels.etapasImplementacao = 'Etapas e temas da implementação (local)';
    for (const [field, label] of Object.entries(labels)) differences.push(...valueChange(label, original?.local?.[field as keyof typeof original.local] ?? (field === 'atividades' || field === 'etapasImplementacao' ? [] : ''), action.local?.[field as keyof typeof action.local] ?? (field === 'atividades' || field === 'etapasImplementacao' ? [] : '')));
    if (!original) differences.unshift({ field: 'Inclusão proposta', before: 'Sem cadastro importado de referência', after: `Nova ação em rascunho local. Identificador: ${action.id}` });
    if (differences.length) revisions.push({ id: action.id, title: `Ação ${action.codigo || 'Sem código oficial'} · UO ${action.codigoUnidadeOrcamentaria || action.unidadeOrcamentaria || 'não informada'}`, differences });
  }
  const indicators = indicatorsFor(state, reference, program.id);
  for (const indicator of indicators) {
    const original = reference.indicators.find((record) => record.id === indicator.id);
    const differences = changedFields(original?.fields || {}, indicator.fields);
    if (associationValue(original?.component || null) !== associationValue(indicator.component)) differences.push({ field: 'Componente acompanhado no MaPR', before: original?.component ? components.find((component) => component.value === associationValue(original.component))?.label || 'Componente anteriormente associado' : '', after: indicator.component ? components.find((component) => component.value === associationValue(indicator.component))?.label || 'Componente não encontrado no mapa atual' : '' });
    if (indicator.origin === 'local') differences.unshift({ field: 'Origem', before: 'Sem registro oficial', after: 'Indicador gerencial complementar local' });
    if (differences.length) revisions.push({ id: indicator.id, title: `Indicador: ${indicator.fields.Indicador || 'sem nome'}`, differences });
  }
  for (const localizer of Object.values(state.planning?.localizerProposals || {}).filter((record) => record.programId === program.id)) {
    const original = baselineLocalizers.get(localizer.id);
    const differences = changedFields(original?.fields || {}, localizer.fields);
    differences.push(...valueChange('Situação proposta do localizador (operação local)', original?.exclusionProposal, localizer.exclusionProposal));
    for (const territory of localizer.territories) {
      const originalTerritory = original?.territories.find((record) => record.id === territory.id);
      differences.push(...changedFields(originalTerritory?.fields || {}, territory.fields).map((change) => ({ ...change, field: `${change.field} · relação ${territory.id.slice(-8)}` })));
    }
    if (!original) differences.unshift({ field: 'Inclusão proposta', before: 'Sem cadastro importado de referência', after: 'Novo localizador em rascunho local, sem código oficial presumido.' });
    const action = state.actions.find((record) => record.id === localizer.actionId);
    if (differences.length) revisions.push({ id: localizer.id, title: `Localizador ${localizer.fields['Código do Localizador'] || 'Sem código oficial'} · ação ${action?.codigo || localizer.fields['Código da Ação'] || 'Sem código oficial'} · UO ${action?.codigoUnidadeOrcamentaria || localizer.fields['Código da Unidade Orçamentária Responsável pela Ação'] || 'não informada'}`, differences });
  }
  if (currentMap) {
    const differences: Difference[] = [];
    const describe = (items: MapItem[]) => items.map((item) => `${item.texto}\nOrigem: ${item.origin || 'local'}${item.associations?.length ? `\nAssociações: ${item.associations.map((association) => components.find((component) => component.value === associationValue(association))?.label || 'Componente não encontrado').join('; ')}` : ''}`).join('\n\n');
    differences.push(...valueChange('Problema ou necessidade de atuação (local)', '', currentMap.problemaCentral));
    for (const section of ['contexto', 'premissas', 'causas', 'resultados', 'impactos'] as const) if (currentMap[section]?.length) differences.push({ field: `${section} (MaPR local)`, before: '', after: describe(currentMap[section]!) });
    for (const mapped of currentMap.actions) {
      for (const section of ['recursos', 'atividades', 'resultados', 'impactos', 'pressupostos', 'riscos'] as const) if (mapped[section]?.length) differences.push({ field: `Ação ${mapped.codigo} / UO ${mapped.codigoUnidadeOrcamentaria || 'local'} — ${section}`, before: '', after: describe(mapped[section]!) });
      const importedAction = reference.actions.find((record) => record.id === (mapped.catalogActionId || mapped.id));
      const importedProducts: MapItem[] = importedAction?.produto ? [{ id: `produto-${importedAction.id}`, texto: importedAction.produto, origin: 'importado' }] : [];
      differences.push(...valueChange(`Ação ${mapped.codigo} / UO ${mapped.codigoUnidadeOrcamentaria || 'local'} — produtos`, describe(importedProducts), describe(mapped.produtos)));
      const describeRoles = (items: MapItem[], principalId: string | undefined) => items.map((item) => `${item.id === principalId ? 'Principal' : 'Secundário'}: ${item.texto}`).join('\n');
      differences.push(...valueChange(`Ação ${mapped.codigo} / UO ${mapped.codigoUnidadeOrcamentaria || 'local'} — organização local das entregas`, describeRoles(importedProducts, importedProducts[0]?.id), describeRoles(mapped.produtos, principalProduct(mapped)?.id)));
    }
    if (differences.length) revisions.push({ id: `mapa-${program.id}`, title: `MaPR do programa ${program.codigo}`, differences });
  }
  for (const request of requests) revisions.push({ id: request.id, title: `Mudança de vínculo · ${request.kind === 'program' ? 'Programa' : 'Ação'} ${state.actions.find((action) => action.id === request.entityId)?.codigo || program.codigo || 'Sem código oficial'}`, differences: [{ field: 'Associação preservada / pretendida', before: text(request.before), after: text(request.after) }, { field: 'Motivo da mudança de vínculo', before: '', after: request.reason }] });
  const brokenIndicators = indicators.filter((indicator) => indicator.component && !components.some((component) => component.value === associationValue(indicator.component)));
  const download = () => {
    const payload = { reference: reference.manifest, program: { imported: originalProgram || null, proposal: program }, actions: state.actions.filter((record) => record.programaId === program.id).map((record) => ({ imported: reference.actions.find((original) => original.id === record.id) || null, proposal: record })), indicators: indicators.map((record) => ({ imported: reference.indicators.find((original) => original.id === record.id) || null, proposal: record })), localizers: Object.values(state.planning!.localizerProposals).filter((record) => record.programId === program.id).map((record) => ({ imported: baselineLocalizers.get(record.id) || null, proposal: record })), differences: revisions, justifications: state.planning!.justifications, review: state.planning!.review, history: state.planning!.history, associationRequests: state.planning!.associationRequests, intendedExercise: state.planning!.intendedExercise, map: state.maps.find((record) => record.programId === program.id) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `revisao-programa-${program.codigo}.json`; link.click(); URL.revokeObjectURL(url);
  };
  const revision = revisions.find((record) => record.id === selected);
  const pending = [...programPending(program), ...state.actions.filter((action) => action.programaId === program.id).flatMap((action) => actionPending(action).map((message) => `Ação ${action.codigo || 'rascunho'}: ${message}`)), ...indicators.flatMap((indicator) => indicatorPending(indicator).map((message) => `${indicator.fields.Indicador || 'Indicador'}: ${message}`))];
  return <>
    <Tabs tabs={[{ id: 'alteracoes', label: 'Alterações propostas' }, { id: 'integridade', label: 'Integridade e avisos' }, { id: 'historico', label: 'Histórico e vínculos' }]} active={tab} onChange={setTab} />
    {tab === 'alteracoes' && <Card title="Revisão do Planejamento" count={revisions.length} lead="Abra uma comparação para conferir as alterações e registrar a justificativa." actions={<ActionButton onClick={download}>Exportar revisão qualitativa</ActionButton>}>
      <HelpTip label="Base de referência da revisão" text={`Exercício ${reference.manifest.exercise} · versão ${reference.manifest.datasetId}. A referência importada é somente leitura.`} />
      <div className="row"><span className="badge gray">Revisão local: {state.planning?.review?.[program.id]?.status === 'revisado' ? 'Revisado' : 'Pendente'}</span><ActionButton sm disabled={!canEditRecord(state, 'program', program)} onClick={() => update((draft) => { draft.planning!.review ||= {}; for (const id of [program.id, ...draft.actions.filter((action) => action.programaId === program.id && canEditRecord(state, 'action', action)).map((action) => action.id)]) draft.planning!.review[id] = { status: 'revisado', reviewedAt: new Date().toISOString() }; })}>Marcar revisão local</ActionButton><HelpTip label="Ajuda: revisão local" text="Não é validação no PPO. Qualquer alteração posterior de programa, ação, indicador ou localizador deixa o cadastro responsável pendente de nova revisão." /></div>
      {!revisions.length && <div className="empty">Nenhuma alteração cadastral neste programa. A proposta mantém os dados importados.</div>}
      <div className="section-tile-grid">{revisions.map((record) => <SectionTile key={record.id} title={record.title} count={record.differences.length} description={state.planning?.justifications[record.id] ? 'Justificativa registrada' : 'Comentário de revisão opcional'} onOpen={() => setSelected(record.id)} />)}</div>
    </Card>}
    {revision && <Modal wide title={revision.title} sub="Comparação com a referência importada" onClose={() => setSelected('')}><div className="revision-record"><div className="table-wrap"><table className="dt revision-table"><thead><tr><th>Campo</th><th>Referência importada</th><th>Proposta local</th></tr></thead><tbody>{revision.differences.map((difference) => <tr key={difference.field}><th>{difference.field}</th><td className="preserve-text">{difference.before || 'Campo vazio / ausente'}</td><td className="preserve-text">{difference.after || 'Campo vazio / removido'}</td></tr>)}</tbody></table></div><FormField label={`Justificativa da alteração — ${revision.title}`} textarea value={state.planning?.justifications[revision.id] || ''} disabled={!editable} onChange={(value) => update((draft) => { draft.planning!.justifications[revision.id] = value; })} /></div></Modal>}
    {tab === 'integridade' && <Card title="Integridade das bases e vínculos" lead="Divergências são informadas sem escolher outra ação automaticamente.">
      {pending.length > 0 && <details open><summary>Pendências de preenchimento ({pending.length})</summary><ul>{pending.map((message, index) => <li key={index}>{message}</li>)}</ul><p>Não impedem salvar e retomar o rascunho.</p></details>}
      {reference.issues.length === 0 && <p>Nenhuma divergência encontrada na importação.</p>}
      {reference.issues.map((issue) => <div className="alert warn" key={issue.id}>{issue.message}<div className="small muted">{issue.recordId}</div></div>)}
      {brokenIndicators.map((indicator) => <div className="alert warn" key={indicator.id}>Indicador {indicator.fields.Indicador}: componente anteriormente associado não encontrado no mapa atual. Revise a associação.</div>)}
      {(state.planning?.migrationNotices || []).map((notice, index) => <div className="alert warn" key={index}>{notice}</div>)}
      <p>{reference.programs.length} programas · {reference.actions.length} ações por programa/UO/código · {reference.indicators.length} indicadores · {reference.localizers.length} localizadores na referência.</p>
      <p className="small muted">O cadastro territorial mantém separadas as situações do programa, da ação e do localizador. Registros excluídos continuam disponíveis para consulta.</p>
    </Card>}
    {tab === 'historico' && <Card title="Histórico da proposta">
      {requests.map((request) => <section className="revision-record" key={request.id}><h3>Mudança de vínculo proposta</h3><div className="grid g2"><div><b>Associação preservada</b><pre className="preserve-text">{JSON.stringify(request.before, null, 2)}</pre></div><div><b>Associação pretendida</b><pre className="preserve-text">{JSON.stringify(request.after, null, 2)}</pre></div></div><p>{request.reason}</p><details><summary>Vínculos conferidos ({request.affected.length})</summary><ul>{request.affected.map((link) => <li key={link}>{link}</li>)}</ul></details><p className="small muted">Sem transferência automática de registros associados.</p></section>)}
      <div className="table-wrap"><table className="dt"><thead><tr><th>Data</th><th>Cadastro</th><th>Operação</th><th>Justificativa</th><th>Comparação</th></tr></thead><tbody>{[...(state.planning?.history || [])].reverse().map((event) => <tr key={event.id}><td>{new Date(event.at).toLocaleString('pt-BR')}</td><td>{event.entityId}</td><td>{event.operation}</td><td>{event.reason || 'Não solicitada'}</td><td><details><summary>Ver registro</summary><b>Antes</b><pre className="preserve-text">{JSON.stringify(event.before, null, 2)}</pre><b>Depois</b><pre className="preserve-text">{JSON.stringify(event.after, null, 2)}</pre></details></td></tr>)}</tbody></table></div>
      {!state.planning?.history?.length && <p className="small muted">Nenhuma operação registrada.</p>}
    </Card>}
  </>;
}
