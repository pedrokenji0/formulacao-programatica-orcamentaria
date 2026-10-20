import { migrateBudgetData, OBZ_BACKUP_KEY, OBZ_DATA_VERSION } from './obzData.ts';
import type { AppState, Action, Program, BudgetItemOBZ } from '../types/index.ts';
import { normalizeCode, setOfficialField, programProperty, actionProperty } from './planningDomain.ts';

export const STORAGE_KEY = 'fpo-state-v2';
export const LEGACY_KEY = 'fpo-state-v1';
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const collectionKeys = ['programs', 'actions', 'frameworks', 'maps', 'budgetItems', 'links', 'mirrors', 'projectMaps'] as const;
const identity = (record: { id?: string; programId?: string }) => record.id || record.programId || '';

export function encodeState(state: AppState, initial: AppState): string {
  const collections: Record<string, unknown> = {};
  for (const key of collectionKeys) {
    const baseline = new Map((initial[key] || []).map((record) => [identity(record), record] as const));
    const current = new Set((state[key] || []).map(identity));
    collections[key] = {
      upserts: (state[key] || []).filter((record) => !same(record, baseline.get(identity(record)))).map((record) => {
        if (key === 'budgetItems' && same((record as BudgetItemOBZ).source, (baseline.get(identity(record)) as BudgetItemOBZ | undefined)?.source)) {
          const { source, ...proposal } = record as BudgetItemOBZ; return proposal;
        }
        return record;
      }),
      removed: (initial[key] || []).filter((record) => !current.has(identity(record))).map(identity),
    };
  }
  return JSON.stringify({ schemaVersion: 2, datasetId: initial.planning?.datasetId, collections,
    values: { perfil: state.perfil, unidade: state.unidade, currentProgramId: state.currentProgramId, planning: state.planning, support: state.support, lists: state.lists, territory: state.territory } });
}

export function decodeState(raw: string, initial: AppState): AppState {
  const parsed = JSON.parse(raw);
  if (parsed.schemaVersion !== 2 || !parsed.collections || !parsed.values || !parsed.values.planning) throw new Error('Formato de persistência incompatível.');
  const next = structuredClone(initial);
  for (const key of collectionKeys) {
    const change = parsed.collections[key];
    if (key === 'projectMaps' && !change) continue; // v2 packages before project maps: retain the new reference.
    if (!change || !Array.isArray(change.upserts) || !Array.isArray(change.removed)) throw new Error(`Coleção inválida: ${key}.`);
    const records = new Map((next[key] || []).filter((record) => !change.removed.includes(identity(record))).map((record) => [identity(record), record]));
    const upsertIds = new Set<string>();
    for (const record of change.upserts) {
      if (!record || !identity(record)) throw new Error(`Identificador ausente em ${key}.`);
      if (upsertIds.has(identity(record))) throw new Error(`Identificador duplicado em ${key}.`);
      upsertIds.add(identity(record));
      if (key === 'budgetItems' && parsed.values.planning.obzDataVersion !== OBZ_DATA_VERSION) record.legacyIdentity = { programaId: record.programaId || '', actionId: record.actionId || '', unidadeOrcamentaria: record.unidadeOrcamentaria || '' };
      const baseline = records.get(identity(record));
      records.set(identity(record), { ...baseline, ...record, ...('officialFields' in (baseline || {}) ? { officialFields: { ...(baseline as Program | Action)?.officialFields, ...record.officialFields } } : {}) });
    }
    (next[key] as unknown[]) = [...records.values()];
  }
  for (const key of ['perfil','unidade','currentProgramId','planning','support','lists','territory'] as const) if (key in parsed.values) (next as unknown as Record<string, unknown>)[key] = parsed.values[key];
  next.schemaVersion = 2;
  next.planning = { ...initial.planning!, ...parsed.values.planning, obzDataVersion: parsed.values.planning.obzDataVersion };
  if (parsed.datasetId !== initial.planning?.datasetId) {
    next.planning!.migrationNotices = [...new Set([...(next.planning!.migrationNotices || []), 'A base importada foi atualizada. Propostas anteriores foram preservadas; confira os avisos e a comparação antes de reutilizá-las.'])];
  }
  if (!next.programs.some((program) => program.id === next.currentProgramId)) next.currentProgramId = next.programs[0]?.id || '';
  if (!['Leitor', 'Gestor UA', 'Gestor Setorial', 'Central Geral', 'Consulta', 'Técnico do Órgão', 'Validador do Órgão', 'DCMEFO/SEPLAG', 'Administrador'].includes(next.perfil)) next.perfil = 'Consulta';
  next.planning!.editingVersion = 1;
  next.planning!.review ||= {};
  next.planning!.history ||= [];
  next.planning!.associationRequests ||= [];
  return migrateBudgetData(next, initial);
}

export function migrateLegacy(previous: AppState, initial: AppState, legacyBaseline: AppState): AppState {
  if (!previous || !Array.isArray(previous.programs) || !Array.isArray(previous.actions) || !Array.isArray(previous.budgetItems)) throw new Error('Pacote sem cadastros esperados.');
  const next = structuredClone(initial);
  const programs = new Map<string, string>();
  const actions = new Map<string, string>();
  const notices = ['Estado anterior preservado na chave fpo-state-v1. Alterações locais foram migradas; confira os vínculos legados na revisão.'];
  const mergeEdits = (target: Program | Action, previousRecord: Program | Action, baseline?: Program | Action) => {
    for (const [field, value] of Object.entries(previousRecord)) {
      if (['id', 'programaId', 'codigo', 'source', 'officialFields', 'sourceVariants'].includes(field)) continue;
      if (!baseline || !same(value, (baseline as unknown as Record<string, unknown>)[field])) {
        (target as unknown as Record<string, unknown>)[field] = value;
        const labels = 'programaId' in target ? actionProperty : programProperty;
        const officialLabel = Object.keys(labels).find((label) => labels[label] === field);
        if (officialLabel && typeof value === 'string') setOfficialField(target, officialLabel, value);
      }
    }
  };
  for (const record of previous.programs) {
    let target = next.programs.find((candidate) => normalizeCode(candidate.codigo) === normalizeCode(record.codigo));
    if (!target) { target = structuredClone(record); next.programs.push(target); }
    else mergeEdits(target, record, legacyBaseline.programs.find((candidate) => candidate.id === record.id));
    programs.set(record.id, target.id);
  }
  for (const record of previous.actions) {
    const unit = normalizeCode(record.codigoUnidadeOrcamentaria || record.unidadeOrcamentaria.match(/^\d+/)?.[0]);
    const candidates = next.actions.filter((candidate) => candidate.programaId === programs.get(record.programaId) && normalizeCode(candidate.codigo) === normalizeCode(record.codigo) && normalizeCode(candidate.codigoUnidadeOrcamentaria) === unit);
    let target = candidates.length === 1 ? candidates[0] : undefined;
    if (!target) {
      target = { ...structuredClone(record), programaId: programs.get(record.programaId) || record.programaId };
      if (!next.actions.some((candidate) => candidate.id === target!.id)) next.actions.push(target);
      notices.push(`Ação legada ${record.codigo}, UO ${unit || 'não informada'}: cadastro preservado separadamente, sem associação automática.`);
    } else mergeEdits(target, record, legacyBaseline.actions.find((candidate) => candidate.id === record.id));
    actions.set(record.id, target.id);
  }
  next.budgetItems = previous.budgetItems.map((record) => ({ ...record, programaId: programs.get(record.programaId) || record.programaId, actionId: actions.get(record.actionId) || record.actionId }));
  next.links = (previous.links || []).map((record) => ({ ...record, actionId: actions.get(record.actionId) || record.actionId }));
  next.frameworks = (previous.frameworks || []).map((record) => ({ ...record, programId: programs.get(record.programId) || record.programId }));
  next.mirrors = (previous.mirrors || []).map((record) => ({ ...record, programId: programs.get(record.programId) || record.programId }));
  for (const record of previous.maps || []) {
    if (same(record, legacyBaseline.maps.find((candidate) => candidate.programId === record.programId))) continue;
    const mapped = { ...record, programId: programs.get(record.programId) || record.programId, actions: record.actions.map((action) => ({ ...action, id: actions.get(action.id) || action.id, catalogActionId: actions.get(action.id) || action.catalogActionId })) };
    const index = next.maps.findIndex((candidate) => candidate.programId === mapped.programId);
    if (index >= 0) next.maps[index] = mapped; else next.maps.push(mapped);
  }
  next.currentProgramId = programs.get(previous.currentProgramId) || next.currentProgramId;
  next.perfil = previous.perfil || next.perfil;
  next.unidade = previous.unidade || next.unidade;
  if (previous.support) next.support = previous.support;
  if (previous.lists) for (const key of Object.keys(next.lists) as (keyof AppState['lists'])[]) next.lists[key] = [...new Set([...next.lists[key], ...(previous.lists[key] || [])])];
  next.planning!.migrationNotices = notices;
  next.planning!.obzDataVersion = undefined;
  return migrateBudgetData(next, initial);
}

export function readPersisted(storage: Pick<Storage, 'getItem' | 'setItem'>, initial: AppState, legacy: AppState): AppState {
  const current = storage.getItem(STORAGE_KEY);
  if (current) {
    try {
      if (JSON.parse(current).values?.planning?.obzDataVersion !== OBZ_DATA_VERSION && !storage.getItem(OBZ_BACKUP_KEY)) storage.setItem(OBZ_BACKUP_KEY, current);
      const next = decodeState(current, initial);
      if (!JSON.parse(current).values?.planning?.editingVersion) {
        const backupKey = `${STORAGE_KEY}-before-editing-rules`;
        if (!storage.getItem(backupKey)) storage.setItem(backupKey, current);
        next.planning!.migrationNotices.push(`Proposta anterior às regras de edição preservada em ${backupKey}. Alterações anteriores não foram apagadas; confira eventuais divergências na revisão.`);
      }
      return next;
    }
    catch (error) {
      const next = structuredClone(initial);
      const backupKey = `${STORAGE_KEY}-backup-${Date.now()}`;
      storage.setItem(backupKey, current);
      next.planning!.migrationNotices.push(`Estado anterior incompatível preservado em ${backupKey}: ${String(error)}.`);
      return next;
    }
  }
  const previous = storage.getItem(LEGACY_KEY);
  if (previous) {
    try { return migrateLegacy(JSON.parse(previous), initial, legacy); }
    catch {
      const next = structuredClone(initial);
      next.planning!.migrationNotices.push('O estado v1 não pôde ser migrado e permanece preservado na chave original.');
      return next;
    }
  }
  return structuredClone(initial);
}
