import type { AppState, OfficialFields, PlanningDataset, PlanningEntityKind, Program, Action, PlanningIndicator, PlanningLocalizer } from '../types/index.ts';
import { normalizeCode, normalizedFlag, programProperty, actionProperty } from './planningDomain.ts';

export type EditingContext = 'reference' | 'proposal' | 'draft' | 'query';
export type RuleSource = 'expressa no manual' | 'observada em tela' | 'decisão do mockup';
export type EditableRecord = Program | Action | PlanningIndicator | PlanningLocalizer;
export const localRecord = (record: EditableRecord) => 'fields' in record ? record.origin === 'local' : record.source?.origin === 'local';
export const canDraftRecord = (state: AppState) => !['Consulta', 'Leitor', 'DCMEFO/SEPLAG'].includes(state.perfil) && (state.perfil !== 'Gestor UA' || !!state.unidade);
export const recordFields = (record: EditableRecord): OfficialFields => 'fields' in record ? record.fields : record.officialFields || {};
export const unitNames = (kind: 'program' | 'action') => kind === 'program'
  ? ['Código da Unidade Orçamentária Responsável pelo Programa', 'Unidade Orçamentária Responsável pelo Programa']
  : ['Código da Unidade Orçamentária Responsável pela Ação', 'Unidade Orçamentária Responsável pela Ação'];
export const noveltyName = (kind: PlanningEntityKind) => ({ program: 'Programa Novo', action: 'Nova Ação', indicator: 'Indicador Novo?', localizer: '' })[kind];
export const exclusionName = (kind: PlanningEntityKind) => ({ program: 'Exclusão Lógica do Programa', action: 'Exclusão Lógica da Ação', indicator: 'Exclusão Lógica do Indicador', localizer: 'Exclusão Lógica do Localizador' })[kind];

export const CLASSIFICATIONS: Record<PlanningEntityKind, string[][]> = {
  program: [['Código da Área Temática', 'Área Temática'], ['Código do Objetivo Estratégico', 'Objetivo Estratégico'], ['Código da Diretriz Estratégica', 'Diretriz Estratégica'], ['Título do Objetivo de Desenvolvimento Sustentável', 'Subtítulo do Objetivo de Desenvolvimento Sustentável'], ['Tipo de Programa'], ['Horizonte Temporal'], unitNames('program')],
  action: [['Código da Função', 'Função'], ['Código da Subfunção', 'Subfunção'], ['Código do Tipo de Ação', 'Tipo de Ação'], ['Código do Identificador de Ação Governamental (IAG)', 'Identificador de Ação Governamental (IAG)'], ['Código do Projeto Estratégico', 'Projeto Estratégico'], ['Código da Área Temática', 'Área Temática'], ['Código do Público-alvo', 'Público-Alvo'], ['Código do Produto', 'Produto'], ['Código da Unidade de Medida do Produto', 'Unidade de Medida do Produto'], ['Setor de Governo'], ['Política para mulheres'], unitNames('action')],
  indicator: [['Unidade de Medida'], ['Periodicidade'], ['Base Geográfica'], ['Polaridade']],
  localizer: [['Código da Região Geográfica Intermediária', 'Região Geográfica Intermediária', 'Código do Município IBGE', 'Código do Município Sigplan', 'Município']],
};
const TEXT_FIELDS: Record<PlanningEntityKind, string[]> = {
  program: ['Nome do Programa', 'Unidade Administrativa Responsável pelo Programa', 'Objetivo', 'Justificativa', 'Causas', 'Estratégia de Implementação', 'Justificativa de Inclusão ou Exclusão do Programa', 'Nome do Gerente', 'E-mail do Gerente', 'Telefone do Gerente', 'Cargo do Gerente'],
  action: ['Título da Ação', 'Unidade Administrativa Responsável pela Ação', 'Finalidade da Ação', 'Descrição da Ação', 'Especificação do Produto', 'Base legal', 'Justificativa de Inclusão ou Exclusão da Ação'],
  indicator: ['Indicador', 'Fórmula de Cálculo', 'Fonte', 'Índice de Referência', 'Data de Apuração', 'Em apuração? (Índice de Referência)', 'Justificativa do Status em apuração do Índice de Referência', 'Justificativa de Exclusão do Indicador'],
  localizer: [],
};
export function fieldRule(kind: PlanningEntityKind, field: string, context: EditingContext) {
  const rule = (editable: boolean, source: RuleSource, reason: string) => ({ editable, source, reason });
  if (context === 'reference' || context === 'query') return rule(false, 'decisão do mockup', 'Referência e consulta não permitem alterações.');
  if (kind === 'action' && ['Código do Tipo de Ação', 'Tipo de Ação'].includes(field) && context !== 'draft') return rule(false, 'expressa no manual', 'Tipo de Ação bloqueado para ação existente (p. 16).');
  if (field === exclusionName(kind)) return rule(false, 'decisão do mockup', 'Utilize a operação de exclusão ou restauração.');
  if (['program', 'action'].includes(kind) && unitNames(kind as 'program' | 'action').includes(field) && context !== 'draft') return rule(false, 'decisão do mockup', 'Mudança de responsabilidade exige proposta específica.');
  const officialCode = { program: 'Código do Programa', action: 'Código da Ação', indicator: 'Código do Indicador', localizer: 'Código do Localizador' }[kind];
  if (field === officialCode) return rule(context === 'draft', 'decisão do mockup', 'Código importado protegido; rascunho pode ter identificação informada ou vazia.');
  if (kind === 'localizer' && CLASSIFICATIONS.localizer[0].includes(field)) return rule(context === 'draft', 'decisão do mockup', 'Território importado preservado; proponha outro localizador (tela p. 26).');
  if (kind === 'program' && field === 'Causas') return rule(true, 'expressa no manual', 'Inclusão, edição e exclusão de causas (p. 31), preservando os identificadores e vínculos.');
  if (kind === 'program' && ['Nome do Gerente', 'E-mail do Gerente', 'Telefone do Gerente', 'Cargo do Gerente'].includes(field)) return rule(true, 'expressa no manual', 'Informações do gerente permitem inclusão e edição (p. 32).');
  if (TEXT_FIELDS[kind].includes(field) || CLASSIFICATIONS[kind].some((group) => group.includes(field))) return rule(true, 'decisão do mockup', 'Editável na proposta local; classificações selecionadas em conjunto.');
  return rule(false, 'decisão do mockup', 'Informação cadastral ou do sistema preservada como referência.');
}
export function canEditRecord(state: AppState, kind: PlanningEntityKind, record: EditableRecord) {
  if (['Consulta', 'Leitor', 'DCMEFO/SEPLAG'].includes(state.perfil)) return false;
  if (state.perfil !== 'Gestor UA') return true;
  let owner: Program | Action | undefined;
  if (kind === 'program' || kind === 'action') owner = record as Program | Action;
  else if (kind === 'indicator') owner = state.programs.find((program) => program.id === (record as PlanningIndicator).programId);
  else owner = state.actions.find((action) => action.id === (record as PlanningLocalizer).actionId);
  const scope = normalizeCode(state.unidade.split(/\s+[-—]\s+/)[0]);
  return !!scope && (!!owner && normalizeCode(owner.codigoUnidadeOrcamentaria) === scope || !!owner && localRecord(owner) && !owner.codigoUnidadeOrcamentaria);
}
export const editingContext = (state: AppState, kind: PlanningEntityKind, record: EditableRecord): EditingContext => !canEditRecord(state, kind, record) ? 'query' : localRecord(record) ? 'draft' : 'proposal';
export function catalogRows(reference: PlanningDataset): OfficialFields[] {
  return [...reference.programs.flatMap((record) => [record.officialFields || {}, ...(record.strategicLinks || [])]), ...reference.actions.map((record) => record.officialFields || {}), ...reference.indicators.map((record) => record.fields)];
}
export function assertFieldPatch(state: AppState, kind: PlanningEntityKind, record: EditableRecord, patch: OfficialFields, reference?: PlanningDataset) {
  if (!canEditRecord(state, kind, record)) throw new Error('Perfil sem permissão para editar este cadastro ou UO.');
  const context = editingContext(state, kind, record);
  const before = recordFields(record);
  for (const [name, value] of Object.entries(patch)) if (value !== (before[name] || '')) {
    const rule = fieldRule(kind, name, context);
    if (!rule.editable) throw new Error(`${name}: ${rule.reason}`);
  }
  const rows = reference ? catalogRows(reference) : [...state.programs.flatMap((program) => [program.officialFields || {}, ...(program.strategicLinks || [])]), ...state.actions.map((action) => action.officialFields || {})];
  for (const group of CLASSIFICATIONS[kind]) {
    if (!group.some((name) => name in patch && patch[name] !== (before[name] || ''))) continue;
    if (!group.every((name) => name in patch)) throw new Error(`Selecione código e descrição conjuntamente: ${group.join(' / ')}.`);
    if (group.every((name) => !patch[name])) continue;
    if (!rows.some((row) => group.every((name) => (row[name] || '') === patch[name]))) throw new Error(`Classificação não encontrada no catálogo: ${group.join(' / ')}.`);
  }
  if (state.perfil === 'Gestor UA' && (kind === 'program' || kind === 'action')) {
    const code = unitNames(kind)[0];
    if (patch[code] && normalizeCode(patch[code]) !== normalizeCode(state.unidade.split(/\s+[-—]\s+/)[0])) throw new Error('Gestor UA: selecione a UO do seu escopo.');
  }
}
export function indicatorPending(indicator: PlanningIndicator): string[] {
  const fields = indicator.fields;
  const pending: string[] = [];
  if (!fields.Indicador?.trim()) pending.push('Nome do indicador — decisão do mockup');
  if (normalizedFlag(fields['Em apuração? (Índice de Referência)']) === true) {
    if ((fields['Justificativa do Status em apuração do Índice de Referência'] || '').trim().length < 60) pending.push('Justificativa de Em apuração: mínimo de 60 caracteres — observada em tela, p. 38');
  } else if (!fields['Índice de Referência']?.trim()) pending.push('Índice numérico ou situação Em apuração — expressa no manual, p. 37');
  else if (!isNumericIndex(fields['Índice de Referência'])) pending.push('Índice de referência deve ser numérico — expressa no manual, p. 37');
  if (!fields['Data de Apuração']?.trim()) pending.push('Data de apuração — decisão do mockup');
  return pending;
}
export const isNumericIndex = (value: string) => /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value.trim());
export function exclusionRequirement(kind: PlanningEntityKind, record: EditableRecord) {
  const novelty = normalizedFlag(recordFields(record)[noveltyName(kind)]);
  const required = kind !== 'localizer' && !localRecord(record) && novelty !== true;
  return { required, unknown: !localRecord(record) && kind !== 'localizer' && novelty === null };
}
export function linkedRecords(state: AppState, kind: 'program' | 'action', id: string, reference: PlanningDataset): string[] {
  if (kind === 'program') return state.actions.filter((action) => action.programaId === id).map((action) => `Ação ${action.codigo || action.id}`)
    .concat([...reference.indicators, ...(state.planning?.localIndicators || [])].filter((indicator) => indicator.programId === id).map((indicator) => `Indicador ${indicator.id}`), state.budgetItems.filter((item) => item.programaId === id).map((item) => `OBZ ${item.id}`));
  return [...new Set([
    ...state.budgetItems.filter((item) => item.actionId === id).map((item) => `OBZ ${item.id}`),
    ...[...reference.localizers, ...Object.values(state.planning?.localizerProposals || {})].filter((record) => record.actionId === id).map((record) => `Localizador ${record.id}`),
    ...state.maps.filter((map) => map.actions.some((action) => (action.catalogActionId || action.id) === id)).map((map) => `MaPR ${map.programId}`),
  ])];
}
export function knownProgramUnit(reference: PlanningDataset, fields: OfficialFields) {
  const names = unitNames('program');
  const matches = reference.programs.filter((program) => names.every((name) => (program.officialFields?.[name] || '') === (fields[name] || '')));
  const organs = [...new Set(matches.map((program) => JSON.stringify([program.codigoOrgao || '', program.orgao || ''])))];
  if (organs.length !== 1) return { 'Código do Órgão Responsável pelo Programa': '', 'Órgão Responsável pelo Programa': '' };
  const [code, name] = JSON.parse(organs[0]);
  return { 'Código do Órgão Responsável pelo Programa': code, 'Órgão Responsável pelo Programa': name };
}
export const officialProperties = { program: programProperty, action: actionProperty };
