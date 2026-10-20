import type { AppState, ProjectPlanningMap, ProjectComponent, ProjectIndicator, ProjectComponentKind } from '../types/index.ts';
import { canEditRecord } from './editingPolicy.ts';
import { originalProjectMap } from './projectMapReference.ts';

export const COMPONENT_LABELS: Record<ProjectComponentKind, string> = {
  contexto: 'Contexto', recurso: 'Recursos', atividade: 'Atividades', produto: 'Produtos',
  resultado: 'Resultados', impacto: 'Impactos', pressuposto: 'Pressupostos',
};
export const CHAIN_STAGES = ['recurso', 'atividade', 'produto', 'resultado', 'impacto'] as const;
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function projectMapsForProgram(state: AppState, programId: string) {
  return (state.projectMaps || []).filter((map) => map.ownerProgramId === programId || map.actionIds.some((id) => state.actions.some((action) => action.id === id && action.programaId === programId)));
}
export function projectMapsForAction(state: AppState, actionId: string) {
  return (state.projectMaps || []).filter((map) => map.actionIds.includes(actionId));
}
export function projectMapForAction(state: AppState, actionId: string) {
  return projectMapsForAction(state, actionId)[0];
}
export function projectMapLabel(map: ProjectPlanningMap) {
  return map.projectType === 'programa' ? 'Mapa geral do programa' : map.origin === 'local' ? 'Demais projetos/processos' : `Projeto estratégico ${map.projectCode}`;
}
export function createLocalProjectMap(state: AppState, input: { name: string; ownerProgramId: string; actionIds: string[]; type: 'demais' | 'programa' }): ProjectPlanningMap {
  const owner = state.programs.find((program) => program.id === input.ownerProgramId);
  if (!owner || !canEditRecord(state, 'program', owner)) throw new Error('Sem permissão para criar mapa neste programa.');
  if (!input.name.trim()) throw new Error('Informe o nome do projeto ou processo.');
  if (input.type === 'programa' && state.projectMaps?.some((map) => map.projectType === 'programa' && map.ownerProgramId === input.ownerProgramId)) throw new Error('Este programa já possui um mapa geral.');
  if (input.actionIds.some((id) => !state.actions.some((action) => action.id === id))) throw new Error('Ação participante não encontrada.');
  const id = crypto.randomUUID();
  return { id: `mapa-local-${id}`, projectId: `projeto-local-${id}`, projectCode: '', projectName: input.name.trim(),
    origin: 'local', projectType: input.type, createdAt: new Date().toISOString(), ownerProgramId: input.ownerProgramId,
    actionIds: [...new Set(input.actionIds)], referenceVersion: 'local-v1', components: [], indicators: [], relations: [] };
}

export function canEditProjectMap(state: AppState, map: ProjectPlanningMap) {
  const program = state.programs.find((record) => record.id === map.ownerProgramId);
  return !!program && canEditRecord(state, 'program', program);
}
export function editableProjectMap(state: AppState, id: string) {
  const map = state.projectMaps?.find((record) => record.id === id);
  if (!map || !canEditProjectMap(state, map)) throw new Error('Mapa do projeto: somente consulta para este perfil ou UO.');
  return map;
}
function recordOperation(state: AppState, map: ProjectPlanningMap, entityId: string, operation: 'reversao' | 'descarte', before: unknown, after: unknown) {
  if (!state.planning) return;
  state.planning.history ||= [];
  state.planning.history.push({ id: `operacao-${crypto.randomUUID()}`, kind: 'projectMap', entityId, operation,
    at: new Date().toISOString(), reason: `Mapa do projeto ${map.projectCode} — ${map.projectName}`,
    before: structuredClone(before), after: structuredClone(after) });
}
export function restoreProjectMap(state: AppState, id: string, view: 'mapr' | 'indicadores') {
  const map = editableProjectMap(state, id);
  const original = originalProjectMap(map);
  const before = structuredClone(map);
  if (view === 'mapr') { map.components = original.components; map.relations = original.relations; }
  else map.indicators = original.indicators;
  recordOperation(state, map, id, 'reversao', before, map);
}
export function restoreProjectRecord(state: AppState, mapId: string, kind: 'componente' | 'indicador', id: string) {
  const map = editableProjectMap(state, mapId);
  const reference = originalProjectMap(map);
  const restore = <T extends { id: string }>(records: T[], originals: T[]) => {
    const source = originals.find((record) => record.id === id);
    if (!source) throw new Error('Rascunho local sem original de referência.');
    const index = records.findIndex((record) => record.id === id);
    const before = index >= 0 ? structuredClone(records[index]) : null;
    if (index >= 0) records[index] = structuredClone(source); else records.push(structuredClone(source));
    return { before, source };
  };
  const restored = kind === 'componente' ? restore(map.components, reference.components) : restore(map.indicators, reference.indicators);
  recordOperation(state, map, id, 'reversao', restored.before, restored.source);
}
export function removeProjectRecord(state: AppState, mapId: string, kind: 'componente' | 'indicador', id: string) {
  const map = editableProjectMap(state, mapId);
  const record = (kind === 'componente' ? map.components : map.indicators).find((item) => item.id === id);
  if (!record) return;
  recordOperation(state, map, id, 'descarte', record, null);
  if (kind === 'componente') map.components = map.components.filter((item) => item.id !== id);
  else map.indicators = map.indicators.filter((item) => item.id !== id);
  // Keep indicator links: a missing component is an explicit integrity warning,
  // not a silent removal of another editor's associations.
}
export function projectMapDifferences(map: ProjectPlanningMap, view?: 'mapr' | 'indicadores') {
  const original = originalProjectMap(map);
  const changes: { field: string; before: string; after: string }[] = [];
  const compare = (field: string, before: unknown, after: unknown) => {
    if (!same(before, after)) changes.push({ field, before: JSON.stringify(before, null, 2), after: JSON.stringify(after, null, 2) });
  };
  if (view !== 'indicadores') {
    for (const kind of Object.keys(COMPONENT_LABELS) as ProjectComponentKind[]) {
      const describe = (items: ProjectComponent[]) => items.filter((item) => item.kind === kind).sort((left, right) => left.order - right.order).map(({ id, text, actionIds }) => ({ id, texto: text, acoes: actionIds }));
      compare(COMPONENT_LABELS[kind], describe(original.components), describe(map.components));
    }
    compare('Relações entre componentes', original.relations, map.relations);
  }
  if (view !== 'mapr') {
    for (const id of new Set([...original.indicators, ...map.indicators].map((item) => item.id))) {
      const before = original.indicators.find((item) => item.id === id);
      const after = map.indicators.find((item) => item.id === id);
      compare(`Indicador: ${after?.name || before?.name || id}`, before || null, after || null);
    }
  }
  return changes;
}

// Shared maps follow the same role/UO policy as the reference program. Metadata
// and documentary origins remain protected, including during a revert.
export function enforceProjectMapUpdate(previous: AppState, next: AppState) {
  const before = previous.projectMaps || [];
  const after = next.projectMaps || [];
  if (new Set(after.map((map) => map.id)).size !== after.length || new Set(after.map((map) => map.projectId)).size !== after.length) throw new Error('Cada projeto ou processo deve ter um único mapa.');
  for (const map of before) if (!after.some((record) => record.id === map.id)) throw new Error('O mapa lógico do projeto deve ser preservado.');
  for (const map of after) {
    const old = before.find((record) => record.id === map.id);
    if (same(old, map)) continue;
    if (!canEditProjectMap(previous, old || map)) throw new Error('Sem permissão para alterar o mapa deste projeto.');
    if (!old) {
      if (map.origin !== 'local' || !['demais', 'programa'].includes(map.projectType || '') || map.referenceVersion !== 'local-v1' || map.projectCode !== '' || !map.id.startsWith('mapa-local-') || !map.projectId.startsWith('projeto-local-') || !map.projectName.trim()) throw new Error('Novo mapa deve ser um rascunho local identificado.');
      if (!map.createdAt || !Number.isFinite(Date.parse(map.createdAt))) throw new Error('Data de criação do mapa inválida.');
      if (map.projectType === 'programa' && after.some((other) => other.id !== map.id && other.projectType === 'programa' && other.ownerProgramId === map.ownerProgramId)) throw new Error('Este programa já possui um mapa geral.');
    }
    if (new Set(map.actionIds).size !== map.actionIds.length || map.actionIds.some((id) => !next.actions.some((action) => action.id === id))) throw new Error('Ações participantes inválidas.');
    for (const key of ['id', 'projectId', 'projectCode', 'projectName', 'ownerProgramId', 'actionIds', 'referenceVersion', 'origin', 'projectType', 'createdAt'] as const) if (old && !same(old[key], map[key])) throw new Error('Identificação e vínculos de referência do mapa são protegidos.');
    const reference = originalProjectMap(old || map);
    const ids = [...map.components, ...map.indicators].map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw new Error('Identificadores de componentes e indicadores devem ser únicos.');
    for (const [records, originals, existing] of [[map.components, reference.components, old?.components || []], [map.indicators, reference.indicators, old?.indicators || []]] as const) {
      for (const record of records) {
        const original = originals.find((item) => item.id === record.id);
        const baseline = existing.find((item) => item.id === record.id);
        if (original ? record.origin !== original.origin || !same(record.source, original.source) : record.origin !== 'local' || record.source !== null) throw new Error('Origem documental e identificação de referência protegidas.');
        if (baseline && !same(baseline.source, record.source)) throw new Error('Fonte de referência protegida.');
      }
    }
    for (const component of map.components) {
      if (!(component.kind in COMPONENT_LABELS) || typeof component.text !== 'string') throw new Error('Componente inválido.');
      if (component.actionIds.some((id) => !map.actionIds.includes(id))) throw new Error('Ação não participante do projeto.');
    }
    for (const indicator of map.indicators) {
      if (!CHAIN_STAGES.includes(indicator.stage)) throw new Error('Categoria de indicador inválida.');
      if (indicator.officialCode !== (reference.indicators.find((record) => record.id === indicator.id)?.officialCode || '')) throw new Error('Código oficial do indicador protegido.');
      if (new Set(indicator.links.map((link) => link.componentId)).size !== indicator.links.length) throw new Error('Associação duplicada.');
      for (const link of indicator.links) {
        if (!['sugerido', 'confirmado'].includes(link.status)) throw new Error('Situação de associação inválida.');
        const baseline = old?.indicators.find((record) => record.id === indicator.id)?.links.find((item) => item.componentId === link.componentId);
        const original = reference.indicators.find((record) => record.id === indicator.id)?.links.find((item) => item.componentId === link.componentId);
        if (!same(baseline, link) && !same(original, link) && !map.components.some((component) => component.id === link.componentId && CHAIN_STAGES.includes(component.kind as typeof CHAIN_STAGES[number]))) throw new Error('Componente não encontrado no mapa.');
      }
    }
    if (next.planning) {
      next.planning.review ||= {};
      next.planning.review[map.id] = { status: 'pendente' };
      for (const id of new Set([map.ownerProgramId, ...map.actionIds.map((id) => next.actions.find((action) => action.id === id)?.programaId).filter(Boolean)])) if (id) next.planning.review[id] = { status: 'pendente' };
    }
  }
}
