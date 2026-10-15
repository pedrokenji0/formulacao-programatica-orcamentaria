import type { AppState, Action, Program, OfficialFields, PlanningLocalizer, PlanningDataset } from '../types';
import { setOfficialField, stableLocalId } from './planningDomain.ts';
import { assertFieldPatch, canEditRecord, canDraftRecord, knownProgramUnit, unitNames } from './editingPolicy.ts';
import { logOperation } from './proposalEditing.ts';

export function draftProgram(state: AppState): string {
  if (!canDraftRecord(state)) throw new Error('Perfil sem permissão para rascunhar.');
  const id = stableLocalId('programa-local');
  state.programs.push({ id, codigo: '', nome: '', unidadeOrcamentaria: '', orgao: '', problemaCentral: '', objetivo: '', justificativa: '', publicoAlvo: '', contexto: '', resultados: [], impactos: [], status: 'RASCUNHO', officialFields: {}, strategicLinks: [], source: { origin: 'local', file: '' } });
  state.currentProgramId = id;
  return id;
}
export function draftAction(state: AppState, programId: string, id = stableLocalId('acao-local')): string {
  const program = state.programs.find((record) => record.id === programId)!;
  if (!program || !canDraftRecord(state)) throw new Error('Programa não encontrado ou sem permissão.');
  state.actions.push({ id, codigo: '', nome: '', programaId: programId, unidadeOrcamentaria: '', orgao: '', funcao: '', subfuncao: '', tipoAcao: '', iag: '', publicoAlvo: '', produto: '', especificacaoProduto: '', unidadeMedida: '', finalidade: '', descricao: '', baseLegal: '', status: 'RASCUNHO', source: { origin: 'local', file: '' }, officialFields: { 'Código do Programa': program.codigo, 'Nome do Programa': program.nome } });
  return id;
}
export function syncActionMetadata(state: AppState, action: Action) {
  for (const map of state.maps) {
    const mapped = map.actions.find((record) => (record.catalogActionId || record.id) === action.id);
    if (mapped) { mapped.codigo = action.codigo; mapped.nome = action.nome; mapped.codigoUnidadeOrcamentaria = action.codigoUnidadeOrcamentaria; mapped.publicoAlvo = action.publicoAlvo; }
  }
  for (const localizer of Object.values(state.planning?.localizerProposals || {})) if (localizer.actionId === action.id && localizer.origin === 'local') {
    localizer.fields = { ...localizer.fields, 'Código da Ação': action.codigo, 'Título da Ação': action.nome, 'Código da Unidade Orçamentária Responsável pela Ação': action.codigoUnidadeOrcamentaria || '', 'Unidade Orçamentária Responsável pela Ação': action.officialFields?.['Unidade Orçamentária Responsável pela Ação'] || '' };
  }
}
export function applyActionFields(state: AppState, actionId: string, fields: OfficialFields, reference?: PlanningDataset) {
  const action = state.actions.find((record) => record.id === actionId)!;
  assertFieldPatch(state, 'action', action, fields, reference);
  for (const [field, value] of Object.entries(fields)) setOfficialField(action, field, value);
  syncActionMetadata(state, action);
}
export function applyProgramFields(state: AppState, programId: string, fields: OfficialFields, reference?: PlanningDataset) {
  const program = state.programs.find((record) => record.id === programId)!;
  assertFieldPatch(state, 'program', program, fields, reference);
  for (const [field, value] of Object.entries(fields)) setOfficialField(program, field, value);
  if (reference && unitNames('program').some((field) => field in fields)) for (const [field, value] of Object.entries(knownProgramUnit(reference, program.officialFields || {}))) setOfficialField(program, field, value);
  for (const action of state.actions.filter((record) => record.programaId === programId)) {
    action.officialFields ||= {};
    if ('Código do Programa' in fields) action.officialFields['Código do Programa'] = program.codigo;
    if ('Nome do Programa' in fields) action.officialFields['Nome do Programa'] = program.nome;
    for (const field of ['Código da Unidade Orçamentária Responsável pelo Programa', 'Unidade Orçamentária Responsável pelo Programa']) if (field in fields) action.officialFields[field] = fields[field];
  }
  for (const indicator of [...(state.planning?.localIndicators || []), ...Object.values(state.planning?.indicatorProposals || {})]) if (indicator.programId === programId) {
    if ('Código do Programa' in fields) indicator.fields['Código do Programa'] = program.codigo;
    if ('Nome do Programa' in fields) indicator.fields['Nome do Programa'] = program.nome;
  }
  for (const localizer of Object.values(state.planning?.localizerProposals || {})) if (localizer.programId === programId && localizer.origin === 'local') {
    localizer.fields['Código do Programa'] = program.codigo;
    localizer.fields['Nome do Programa'] = program.nome;
  }
}
export function catalogOptions(rows: OfficialFields[], names: string[]): OfficialFields[] {
  return [...new Map(rows.filter((row) => names.some((name) => row[name])).map((row) => { const choice = Object.fromEntries(names.map((name) => [name, row[name] || ''])); return [JSON.stringify(choice), choice]; })).values()];
}
export function programPending(program: Program): string[] {
  return [['Nome do Programa', program.nome], ['UO responsável', program.codigoUnidadeOrcamentaria], ['Objetivo do Programa', program.objetivo], ['Justificativa do Programa', program.justificativa], ['Estratégia de Implementação', program.estrategiaImplementacao]].filter(([, value]) => !value?.trim()).map(([label]) => `${label} — decisão do mockup`);
}
export function actionPending(action: Action): string[] {
  return [['Título da Ação', action.nome], ['UO responsável', action.codigoUnidadeOrcamentaria], ['Finalidade da Ação', action.finalidade], ['Produto', action.produto], ['Especificação do Produto', action.especificacaoProduto], ['Unidade de Medida do Produto', action.unidadeMedida]].filter(([, value]) => !value?.trim()).map(([label]) => `${label} — decisão do mockup`);
}
export function causeItems(program: Program) {
  if (program.causeItems) return program.causeItems;
  return (program.officialFields?.Causas || program.causas || '').split(/\s+\/\s*|\r?\n/).map((texto) => texto.trim()).filter(Boolean).map((texto, index) => ({ id: `causa-importada-${program.id}-${index}`, texto }));
}
export function draftLocalizer(state: AppState, action: Action, id = stableLocalId('localizador-local'), territoryId = stableLocalId('territorio-local')): string {
  if (!canEditRecord(state, 'action', action)) throw new Error('Sem permissão para rascunhar localizador.');
  const program = state.programs.find((record) => record.id === action.programaId)!;
  const record: PlanningLocalizer = { id, origin: 'local', actionId: action.id, expectedActionId: action.id, programId: program.id, fields: { 'Código do Localizador': '', 'Exclusão Lógica do Localizador': '', 'Código do Programa': program.codigo, 'Nome do Programa': program.nome, 'Código da Ação': action.codigo, 'Título da Ação': action.nome, 'Código da Unidade Orçamentária Responsável pela Ação': action.codigoUnidadeOrcamentaria || '', 'Unidade Orçamentária Responsável pela Ação': action.officialFields?.['Unidade Orçamentária Responsável pela Ação'] || '' }, territories: [{ id: territoryId, fields: { 'Código da Região Geográfica Intermediária': '', 'Região Geográfica Intermediária': '', 'Código do Município IBGE': '', 'Código do Município Sigplan': '', Município: '' }, statusFields: {} }] };
  state.planning!.localizerProposals[id] = record;
  return record.territories[0].id;
}
export function restoreProgram(state: AppState, reference: PlanningDataset, programId: string) {
  const original = reference.programs.find((record) => record.id === programId);
  const index = state.programs.findIndex((record) => record.id === programId);
  if (!original || index < 0) return false;
  if (!canEditRecord(state, 'program', state.programs[index])) throw new Error('Sem permissão para reverter.');
  logOperation(state, 'program', programId, 'reversao', state.programs[index], original);
  const { sourceVariants, ...record } = structuredClone(original);
  state.programs[index] = record;
  applyProgramFields(state, programId, { 'Código do Programa': record.codigo, 'Nome do Programa': record.nome }, reference);
  return true;
}
export function restoreAction(state: AppState, reference: PlanningDataset, actionId: string) {
  const original = reference.actions.find((record) => record.id === actionId);
  const index = state.actions.findIndex((record) => record.id === actionId);
  if (!original || index < 0) return false;
  if (!canEditRecord(state, 'action', state.actions[index])) throw new Error('Sem permissão para reverter.');
  logOperation(state, 'action', actionId, 'reversao', state.actions[index], original);
  const { sourceVariants, ...record } = structuredClone(original);
  state.actions[index] = record;
  syncActionMetadata(state, record);
  return true;
}
