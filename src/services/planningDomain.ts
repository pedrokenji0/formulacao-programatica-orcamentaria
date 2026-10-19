import type { AppState, Action, Program, PlanningDataset, PlanningIndicator, PlanningLocalizer, OfficialFields, ProcessMap, ComponentAssociation } from '../types';
import { createProjectMapReferences } from './projectMapReference.ts';

export const normalizeCode = (value: string | undefined) => String(value ?? '').trim().replace(/^0+(?=\d)/, '');
export const normalizedFlag = (value: string | undefined): boolean | null => /^(sim|true|1)$/i.test(value?.trim() || '') ? true : /^(não|nao|false|0)$/i.test(value?.trim() || '') ? false : null;
export const situation = (value: string | undefined) => normalizedFlag(value) === true ? 'Excluído' : normalizedFlag(value) === false ? 'Ativo' : 'Não informado';
export const stableLocalId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const programProperty: Record<string, keyof Program> = {
  'Código do Programa': 'codigo',
  'Nome do Programa': 'nome', 'Unidade Administrativa Responsável pelo Programa': 'unidadeAdministrativa',
  'Órgão Responsável pelo Programa': 'orgao', 'Área Temática': 'areaTematica', Objetivo: 'objetivo',
  Justificativa: 'justificativa', 'Horizonte Temporal': 'horizonteTemporal', 'Tipo de Programa': 'tipoPrograma',
  Causas: 'causas', 'Estratégia de Implementação': 'estrategiaImplementacao', 'Código do Órgão Responsável pelo Programa': 'codigoOrgao', 'Código da Unidade Orçamentária Responsável pelo Programa': 'codigoUnidadeOrcamentaria',
};
export const actionProperty: Record<string, keyof Action> = {
  'Código da Ação': 'codigo',
  'Título da Ação': 'nome', 'Unidade Administrativa Responsável pela Ação': 'unidadeAdministrativa',
  Função: 'funcao', Subfunção: 'subfuncao', 'Tipo de Ação': 'tipoAcao', 'Identificador de Ação Governamental (IAG)': 'iag',
  'Público-Alvo': 'publicoAlvo', 'Política para mulheres': 'relacaoMulher', Produto: 'produto',
  'Especificação do Produto': 'especificacaoProduto', 'Unidade de Medida do Produto': 'unidadeMedida',
  'Finalidade da Ação': 'finalidade', 'Descrição da Ação': 'descricao', 'Base legal': 'baseLegal',
  'Código do Projeto Estratégico': 'codigoProjetoEstrategico', 'Projeto Estratégico': 'projetoEstrategico',
  'Código do Produto': 'codigoProduto', 'Código da Unidade Orçamentária Responsável pela Ação': 'codigoUnidadeOrcamentaria',
};
export function setOfficialField(entity: Program | Action, field: string, value: string) {
  entity.officialFields = { ...entity.officialFields, [field]: value };
  const property = ('programaId' in entity ? actionProperty : programProperty)[field];
  if (property) (entity as unknown as Record<string, unknown>)[property] = value;
  const unitPrefix = 'programaId' in entity ? 'Ação' : 'Programa';
  if (field.includes('Unidade Orçamentária Responsável')) {
    entity.unidadeOrcamentaria = [entity.officialFields[`Código da Unidade Orçamentária Responsável pelo ${unitPrefix}`] || entity.officialFields[`Código da Unidade Orçamentária Responsável pela ${unitPrefix}`], entity.officialFields[`Unidade Orçamentária Responsável pelo ${unitPrefix}`] || entity.officialFields[`Unidade Orçamentária Responsável pela ${unitPrefix}`]].filter(Boolean).join(' - ');
  }
}
export function createPlanningInitial(legacy: AppState, reference: PlanningDataset): AppState {
  const programs = reference.programs.map(({ sourceVariants, ...program }) => structuredClone(program));
  const actions = reference.actions.map(({ sourceVariants, ...action }) => structuredClone(action));
  const programIds = new Map(legacy.programs.map((program) => [program.id, programs.find((candidate) => normalizeCode(candidate.codigo) === normalizeCode(program.codigo))?.id || program.id]));
  const actionIds = new Map(legacy.actions.map((action) => [action.id, actions.find((candidate) => candidate.programaId === programIds.get(action.programaId) && normalizeCode(candidate.codigo) === normalizeCode(action.codigo) && normalizeCode(candidate.codigoUnidadeOrcamentaria) === normalizeCode(action.codigoUnidadeOrcamentaria || action.unidadeOrcamentaria.match(/^\d+/)?.[0]))?.id || action.id]));
  const maps: ProcessMap[] = programs.map((program) => ({
    programId: program.id, problemaCentral: '', contexto: [], premissas: [], causas: [], resultados: [], impactos: [], status: 'RASCUNHO',
    actions: actions.filter((action) => action.programaId === program.id).map((action) => ({
      id: action.id, catalogActionId: action.id, codigoUnidadeOrcamentaria: action.codigoUnidadeOrcamentaria, codigo: action.codigo, nome: action.nome, objetivo: '', publicoAlvo: action.publicoAlvo,
      recursos: [], atividades: [], produtos: action.produto ? [{ id: `produto-${action.id}`, texto: action.produto, categoria: action.unidadeMedida, origin: 'importado', sourceReference: 'Produto / Especificação do Produto' }] : [], pressupostos: [], riscos: [],
    })),
  }));
  return {
    ...structuredClone(legacy), schemaVersion: 2, programs, actions, maps, projectMaps: createProjectMapReferences(actions), frameworks: [], mirrors: [], links: [],
    currentProgramId: programs.find((program) => normalizeCode(program.codigo) === '125')?.id || programs[0]?.id || '',
    unidade: actions.find((action) => normalizeCode(action.codigo) === '1082' && normalizeCode(action.codigoUnidadeOrcamentaria) === '1221')?.unidadeOrcamentaria || '',
    budgetItems: legacy.budgetItems.map((item) => ({ ...item, programaId: programIds.get(item.programaId) || item.programaId, actionId: actionIds.get(item.actionId) || item.actionId })),
    lists: { ...legacy.lists, unidades: [...new Set(actions.map((action) => action.unidadeOrcamentaria))], programas: programs.map((program) => `${program.codigo} - ${program.nome}`), acoes: [...new Set(actions.map((action) => `${action.codigo} - ${action.nome}`))] },
    planning: { datasetId: reference.manifest.datasetId, exercise: reference.manifest.exercise, indicatorProposals: {}, localIndicators: [], localizerProposals: {}, justifications: {}, migrationNotices: [], editingVersion: 1, review: {}, history: [], associationRequests: [] },
  };
}
export function indicatorsFor(state: AppState, reference: PlanningDataset, programId: string): PlanningIndicator[] {
  return [...reference.indicators.filter((indicator) => indicator.programId === programId).map((indicator) => state.planning?.indicatorProposals[indicator.id] || indicator), ...(state.planning?.localIndicators || []).filter((indicator) => indicator.programId === programId)];
}
export const proposedLocalizer = (state: AppState, record: PlanningLocalizer) => state.planning?.localizerProposals[record.id] || record;
export function mapComponents(map: ProcessMap | undefined): { value: string; label: string; association: ComponentAssociation }[] {
  if (!map) return [];
  return [
    ...map.actions.flatMap((action) => (['recursos', 'atividades', 'produtos', 'resultados', 'impactos'] as const).flatMap((section) => (action[section] || []).map((item) => {
      const kind = ({ recursos: 'recurso', atividades: 'atividade', produtos: 'produto', resultados: 'resultado', impactos: 'impacto' } as const)[section];
      return { value: `${kind}|${action.id}|${item.id}`, label: `${kind} · ação ${action.codigo} · UO ${action.codigoUnidadeOrcamentaria || 'não informada'} · ${item.texto}`, association: { kind, actionId: action.id, componentId: item.id } };
    }))),
    ...(['resultados', 'impactos'] as const).flatMap((section) => map[section].map((item) => {
      const kind: 'resultado' | 'impacto' = section === 'resultados' ? 'resultado' : 'impacto';
      return { value: `${kind}||${item.id}`, label: `${kind} · ${item.texto}`, association: { kind, componentId: item.id } };
    })),
  ];
}
export const associationValue = (association: ComponentAssociation | null) => association ? `${association.kind}|${association.actionId || ''}|${association.componentId}` : '';
export function changedFields(reference: OfficialFields, proposal: OfficialFields) {
  return [...new Set([...Object.keys(reference), ...Object.keys(proposal)])].filter((field) => reference[field] !== proposal[field]).map((field) => ({ field, before: reference[field] ?? '', after: proposal[field] ?? '' }));
}
