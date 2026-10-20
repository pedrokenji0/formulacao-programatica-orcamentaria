import { enforceTerritoryUpdate } from './territoryDomain.ts';
import { enforceBudgetUpdate, unitCode } from './obzData.ts';
import type { AppState, PlanningDataset, PlanningEntityKind, ProposalEvent } from '../types/index.ts';
import type { EditableRecord } from './editingPolicy.ts';
import { assertFieldPatch, canEditRecord, CLASSIFICATIONS, exclusionName, exclusionRequirement, localRecord, recordFields, officialProperties, linkedRecords, knownProgramUnit, unitNames } from './editingPolicy.ts';
import { normalizedFlag, stableLocalId, changedFields, setOfficialField, mapComponents, associationValue } from './planningDomain.ts';
import { enforceProjectMapUpdate } from './projectMapDomain.ts';

const same = (before: unknown, after: unknown) => JSON.stringify(before) === JSON.stringify(after);
export function proposalRecord(state: AppState, reference: PlanningDataset, kind: PlanningEntityKind, id: string): EditableRecord | undefined {
  if (kind === 'program') return state.programs.find((record) => record.id === id);
  if (kind === 'action') return state.actions.find((record) => record.id === id);
  if (kind === 'indicator') return state.planning?.localIndicators.find((record) => record.id === id) || state.planning?.indicatorProposals[id] || reference.indicators.find((record) => record.id === id);
  return state.planning?.localizerProposals[id] || reference.localizers.find((record) => record.id === id);
}
export function editableProposalRecord(state: AppState, reference: PlanningDataset, kind: PlanningEntityKind, id: string): EditableRecord {
  const record = proposalRecord(state, reference, kind, id);
  if (!record || !canEditRecord(state, kind, record)) throw new Error('Cadastro não encontrado ou sem permissão de edição.');
  if (kind === 'indicator' && !localRecord(record)) return state.planning!.indicatorProposals[id] ||= structuredClone(record as typeof reference.indicators[number]);
  if (kind === 'localizer') return state.planning!.localizerProposals[id] ||= structuredClone(record as typeof reference.localizers[number]);
  return record;
}
export function logOperation(state: AppState, kind: PlanningEntityKind, entityId: string, operation: ProposalEvent['operation'], before: unknown, after: unknown, reason = '') {
  state.planning!.history ||= [];
  state.planning!.history.push({ id: stableLocalId('operacao'), entityId, kind, operation, before: structuredClone(before), after: structuredClone(after), reason, at: new Date().toISOString() });
}
export function changeSituation(state: AppState, reference: PlanningDataset, kind: PlanningEntityKind, id: string, excluded: boolean, reason = '') {
  const record = editableProposalRecord(state, reference, kind, id);
  if (localRecord(record)) throw new Error('Use Descartar rascunho para um registro criado localmente.');
  const requirement = exclusionRequirement(kind, record);
  if (excluded && requirement.required && !reason.trim()) throw new Error('Informe a justificativa de exclusão.');
  const field = exclusionName(kind);
  const fields = recordFields(record);
  logOperation(state, kind, id, excluded ? 'exclusao' : 'restauracao', { [field]: fields[field] || '' }, { [field]: excluded ? 'Sim' : 'Não' }, reason);
  if ('officialFields' in record || kind === 'program' || kind === 'action') setOfficialField(record as typeof reference.programs[number], field, excluded ? 'Sim' : 'Não');
  else fields[field] = excluded ? 'Sim' : 'Não';
  if (kind === 'localizer' && 'territories' in record) record.exclusionProposal = excluded;
  if (excluded && reason) fields[kind === 'program' ? 'Justificativa de Inclusão ou Exclusão do Programa' : kind === 'action' ? 'Justificativa de Inclusão ou Exclusão da Ação' : 'Justificativa de Exclusão do Indicador'] = reason;
}
export function discardDraft(state: AppState, reference: PlanningDataset, kind: PlanningEntityKind, id: string) {
  const record = editableProposalRecord(state, reference, kind, id);
  if (!localRecord(record)) throw new Error('Cadastros importados não podem ser descartados.');
  if ((kind === 'program' || kind === 'action') && linkedRecords(state, kind, id, reference).length) throw new Error('O rascunho tem registros vinculados. Remova ou resolva esses vínculos antes de descartá-lo.');
  const archive = kind === 'program' ? { ...record, discardedMaps: state.maps.filter((map) => map.programId === id), discardedFrameworks: state.frameworks.filter((framework) => framework.programId === id) } : record;
  logOperation(state, kind, id, 'descarte', archive, null);
  if (kind === 'program') {
    state.programs = state.programs.filter((program) => program.id !== id);
    state.frameworks = state.frameworks.filter((framework) => framework.programId !== id);
    state.maps = state.maps.filter((map) => map.programId !== id);
    if (state.currentProgramId === id) state.currentProgramId = state.programs[0]?.id || '';
  } else if (kind === 'action') state.actions = state.actions.filter((action) => action.id !== id);
  else if (kind === 'indicator') state.planning!.localIndicators = state.planning!.localIndicators.filter((indicator) => indicator.id !== id);
  else delete state.planning!.localizerProposals[id];
}
export function editIndicator(state: AppState, reference: PlanningDataset, id: string, fields: Record<string, string>) {
  const record = editableProposalRecord(state, reference, 'indicator', id) as typeof reference.indicators[number];
  assertFieldPatch(state, 'indicator', record, fields, reference);
  Object.assign(record.fields, fields);
  if (normalizedFlag(record.fields['Em apuração? (Índice de Referência)']) === true) record.fields['Índice de Referência'] = '';
}
export function proposeAssociation(state: AppState, reference: PlanningDataset, kind: 'program' | 'action', id: string, fields: Record<string, string>, reason: string, programId?: string) {
  const record = editableProposalRecord(state, reference, kind, id);
  if (!reason.trim()) throw new Error('Informe o motivo da mudança de vínculo.');
  const names = unitNames(kind);
  const selected = Object.fromEntries(names.map((name) => [name, fields[name] || '']));
  const candidates = [...reference.programs.map((program) => program.officialFields || {}), ...reference.actions.map((action) => action.officialFields || {})];
  if (!candidates.some((row) => names.every((name) => (row[name] || '') === selected[name])) || !selected[names[0]]) throw new Error('Selecione uma UO do catálogo.');
  if (programId && !state.programs.some((program) => program.id === programId)) throw new Error('Programa de destino não encontrado.');
  const request = { id: stableLocalId('vinculo-proposto'), kind, entityId: id, before: { programId: 'programaId' in record ? record.programaId : undefined, fields: Object.fromEntries(names.map((name) => [name, recordFields(record)[name] || ''])) }, after: { programId, fields: kind === 'program' ? { ...selected, ...knownProgramUnit(reference, selected) } : selected }, reason, affected: linkedRecords(state, kind, id, reference) };
  state.planning!.associationRequests ||= [];
  state.planning!.associationRequests.push(request);
  logOperation(state, kind, id, 'vinculo', request.before, request.after, reason);
}
export function enforceEditingUpdate(previous: AppState, next: AppState, reference: PlanningDataset) {
  enforceTerritoryUpdate(previous, next, reference);
  enforceBudgetUpdate(previous, next);
  if (!next.planning || !previous.planning) return;
  enforceProjectMapUpdate(previous, next);
  if (['Consulta', 'Leitor'].includes(previous.perfil) && !same(previous.planning, next.planning)) throw new Error('Perfil Leitor: somente consulta.');
  if (next.planning.exercise !== previous.planning.exercise || next.planning.datasetId !== previous.planning.datasetId) throw new Error('Exercício e origem da referência são protegidos.');
  const events = (next.planning.history || []).filter((event) => !(previous.planning?.history || []).some((old) => old.id === event.id));
  if (!same((next.planning.history || []).slice(0, previous.planning.history?.length || 0), previous.planning.history || [])) throw new Error('Histórico anterior protegido.');
  for (const [id, review] of Object.entries(next.planning.review || {})) if (!same(review, previous.planning.review?.[id])) {
    const kind = next.programs.some((program) => program.id === id) ? 'program' : 'action';
    const record = proposalRecord(previous, reference, kind, id);
    if (record && !canEditRecord(previous, kind, record)) throw new Error('Sem permissão para revisar este cadastro.');
  }
  const operation = (kind: PlanningEntityKind, id: string, name: ProposalEvent['operation']) => events.some((event) => event.kind === kind && event.entityId === id && event.operation === name);
  next.planning.review ||= {};
  const pending = (id: string | undefined) => { if (id) next.planning!.review![id] = { status: 'pendente' }; };
  for (const kind of ['program', 'action', 'indicator', 'localizer'] as const) {
    const before: EditableRecord[] = kind === 'program' ? previous.programs : kind === 'action' ? previous.actions : kind === 'indicator'
      ? [...reference.indicators.map((record) => previous.planning!.indicatorProposals[record.id] || record), ...previous.planning.localIndicators]
      : Object.values(previous.planning.localizerProposals);
    const after: EditableRecord[] = kind === 'program' ? next.programs : kind === 'action' ? next.actions : kind === 'indicator'
      ? [...reference.indicators.map((record) => next.planning!.indicatorProposals[record.id] || record), ...next.planning.localIndicators]
      : Object.values(next.planning.localizerProposals);
    const originals = new Map<string, EditableRecord>(before.map((record) => [record.id, record] as const));
    for (const record of after) {
      const old = originals.get(record.id) || proposalRecord(previous, reference, kind, record.id);
      if (old && same(old, record)) continue;
      if (old && (kind === 'action' || kind === 'indicator' || kind === 'localizer')) {
        const parentId = 'programaId' in record ? record.programaId : 'programId' in record ? record.programId : '';
        const parent = next.programs.find((program) => program.id === parentId);
        const changes = changedFields(recordFields(old), recordFields(record));
        const copied = 'fields' in record ? { ...record, fields: recordFields(old) } : { ...record, officialFields: recordFields(old) };
        if (parent && same(old, copied) && changes.every((change) => change.field === 'Código do Programa' && change.after === parent.codigo || change.field === 'Nome do Programa' && change.after === parent.nome)) continue;
      }
      if (!canEditRecord(previous, kind, old || record)) throw new Error('Perfil sem permissão para alterar este cadastro ou UO.');
      if (!old && !localRecord(record)) throw new Error('Novos cadastros só podem ser rascunhos locais.');
      if (old && localRecord(old) !== localRecord(record)) throw new Error('Origem do registro protegida.');
      if (old && !operation(kind, record.id, 'reversao')) {
        const patch = Object.fromEntries(changedFields(recordFields(old), recordFields(record)).map((change) => [change.field, change.after]));
        const parentId = 'programaId' in record ? record.programaId : 'programId' in record ? record.programId : '';
        const parent = next.programs.find((program) => program.id === parentId);
        if (parent) for (const [field, value] of Object.entries({ 'Código do Programa': parent.codigo, 'Nome do Programa': parent.nome })) if (patch[field] === value) delete patch[field];
        if (parent && kind === 'action') for (const field of unitNames('program')) if (patch[field] === parent.officialFields?.[field]) delete patch[field];
        if (kind === 'localizer' && localRecord(record) && 'actionId' in record) {
          const action = next.actions.find((candidate) => candidate.id === record.actionId);
          if (action) for (const [field, value] of Object.entries({ 'Código da Ação': action.codigo, 'Título da Ação': action.nome, ...Object.fromEntries(unitNames('action').map((name) => [name, action.officialFields?.[name] || ''])) })) if (patch[field] === value) delete patch[field];
        }
        if (kind === 'program') for (const [field, value] of Object.entries(knownProgramUnit(reference, recordFields(record)))) if (patch[field] === value) delete patch[field];
        if (exclusionName(kind) in patch) {
          const name = normalizedFlag(patch[exclusionName(kind)]) === true ? 'exclusao' : 'restauracao';
          if (!operation(kind, record.id, name)) throw new Error('Situação cadastral exige operação específica.');
          delete patch[exclusionName(kind)];
        }
        if (kind === 'program' || kind === 'action') {
          for (const [field, property] of Object.entries(officialProperties[kind])) {
            const oldValue = (old as unknown as Record<string, unknown>)[property];
            const newValue = (record as unknown as Record<string, unknown>)[property];
            if (oldValue !== newValue && typeof newValue === 'string' && !(field in patch)) patch[field] = newValue;
          }
          if (kind === 'action' && 'programaId' in old && 'programaId' in record && old.programaId !== record.programaId) throw new Error('Vínculo de programa exige proposta específica; registros associados não são transferidos.');
          if ('source' in old && 'source' in record && !same(old.source, record.source)) throw new Error('Metadados de importação protegidos.');
          if (kind === 'program' && 'ppoComplements' in record && record.ppoComplements?.PPAG !== ('ppoComplements' in old ? old.ppoComplements?.PPAG : undefined)) throw new Error('PPAG da referência não pode ser editado.');
        }
        if ('programId' in old && 'programId' in record && old.programId !== record.programId) throw new Error('Programa associado protegido.');
        if ('actionId' in old && 'actionId' in record && (old.actionId !== record.actionId || 'expectedActionId' in old && 'expectedActionId' in record && old.expectedActionId !== record.expectedActionId)) throw new Error('Ação associada ao localizador protegida.');
        for (const group of CLASSIFICATIONS[kind]) if (group.some((name) => name in patch)) for (const name of group) if (!(name in patch)) patch[name] = recordFields(record)[name] || '';
        if (kind === 'program') for (const [field, value] of Object.entries(knownProgramUnit(reference, recordFields(record)))) if (patch[field] === value) delete patch[field];
        assertFieldPatch(previous, kind, old, patch, reference);
        if (kind === 'program' || kind === 'action') for (const [field, value] of Object.entries(patch)) setOfficialField(record as typeof reference.programs[number], field, value);
        if (kind === 'localizer' && 'territories' in old && 'territories' in record && !localRecord(old) && !same(old.territories, record.territories)) throw new Error('Território importado protegido; proponha outro localizador.');
        if (kind === 'localizer' && 'territories' in old && 'territories' in record && old.exclusionProposal !== record.exclusionProposal && !operation(kind, record.id, record.exclusionProposal ? 'exclusao' : 'restauracao')) throw new Error('Situação do localizador exige operação específica.');
        if (kind === 'program' && 'strategicLinks' in record && 'strategicLinks' in old && !same(old.strategicLinks, record.strategicLinks)) {
          for (const link of record.strategicLinks || []) for (const group of CLASSIFICATIONS.program.slice(1, 4)) if (group.some((field) => link[field])) assertFieldPatch(previous, 'program', { ...record, officialFields: {} }, Object.fromEntries(group.map((name) => [name, link[name] || ''])), reference);
        }
      }
      if (kind === 'indicator' && 'component' in record) {
        const oldValue = old && 'component' in old ? associationValue(old.component) : '';
        if (record.component && oldValue !== associationValue(record.component) && !mapComponents(next.maps.find((map) => map.programId === record.programId)).some((component) => component.value === associationValue(record.component))) throw new Error('Componente não encontrado no MaPR do programa.');
        if (normalizedFlag(record.fields['Em apuração? (Índice de Referência)']) === true) record.fields['Índice de Referência'] = '';
      }
      if (kind === 'localizer' && localRecord(record) && 'territories' in record) for (const territory of record.territories) {
        const fields = CLASSIFICATIONS.localizer[0];
        if (fields.some((field) => territory.fields[field]) && !reference.localizers.some((localizer) => localizer.territories.some((candidate) => fields.every((field) => (candidate.fields[field] || '') === (territory.fields[field] || ''))))) throw new Error('Território não encontrado no catálogo.');
      }
      pending(record.id);
      if (kind === 'indicator' && 'programId' in record) pending(record.programId);
      if (kind === 'localizer' && 'actionId' in record) pending(record.actionId || undefined);
      if (kind === 'action' && 'programaId' in record) pending(record.programaId);
    }
    for (const record of before) if (!after.some((item) => item.id === record.id) && !operation(kind, record.id, 'descarte')) throw new Error('Cadastros só podem ser descartados por operação específica.');
  }
  for (const key of ['maps', 'frameworks', 'budgetItems', 'links', 'mirrors', 'support', 'lists'] as const) {
    if (!same(previous[key], next[key]) && ['Consulta', 'Leitor'].includes(previous.perfil)) throw new Error('Perfil Leitor: somente consulta.');
  }
  if (previous.perfil === 'Gestor UA') {
    for (const map of next.maps) {
      const old = previous.maps.find((record) => record.programId === map.programId);
      if (same(old, map)) continue;
      const program = previous.programs.find((record) => record.id === map.programId) || next.programs.find((record) => record.id === map.programId);
      if (!program || !canEditRecord(previous, 'program', program)) throw new Error('MaPR fora do escopo da UO.');
      for (const action of map.actions) if (!same(action, old?.actions.find((record) => record.id === action.id))) {
        const target = next.actions.find((record) => record.id === (action.catalogActionId || action.id));
        if (target && !canEditRecord(previous, 'action', target)) throw new Error('Ação do mapa fora do escopo da UO.');
      }
    }
    for (const item of next.budgetItems) if (!same(item, previous.budgetItems.find((record) => record.id === item.id))) {
      const target = next.actions.find((record) => record.id === item.actionId);
      if (unitCode(previous.unidade) !== unitCode(item.codigoUnidadeOrcamentaria || item.unidadeOrcamentaria) || (target && !canEditRecord(previous, 'action', target))) throw new Error('Item OBZ fora do escopo da UO.');
    }
  }
  if (!same(previous.planning.justifications, next.planning.justifications) && ['Consulta', 'Leitor'].includes(previous.perfil)) throw new Error('Perfil Leitor: somente consulta.');
  for (const request of next.planning.associationRequests || []) if (!(previous.planning.associationRequests || []).some((old) => old.id === request.id)) pending(request.entityId);
  for (const map of next.maps) if (!same(map, previous.maps.find((record) => record.programId === map.programId))) pending(map.programId);
  for (const framework of next.frameworks) if (!same(framework, previous.frameworks.find((record) => record.programId === framework.programId))) pending(framework.programId);
}
