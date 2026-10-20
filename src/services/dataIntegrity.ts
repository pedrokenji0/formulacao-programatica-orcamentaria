import type { AppState } from '../types/index.ts';
import { codeOf, effectiveBudgetTotal, unitCode } from './obzData.ts';

export interface DataFinding { code: string; level: 'erro' | 'aviso' | 'informacao'; area: 'planejamento' | 'mapas' | 'obz'; recordId: string; message: string }
export function auditPlanningData(state: AppState): DataFinding[] {
  const findings: DataFinding[] = [];
  const add = (code: string, level: DataFinding['level'], area: DataFinding['area'], recordId: string, message: string) => findings.push({ code, level, area, recordId, message });
  const unique = (records: { id: string }[], label: string, area: DataFinding['area']) => {
    const seen = new Set<string>();
    for (const record of records) { if (!record.id || seen.has(record.id)) add('id-duplicado', 'erro', area, record.id, label + ': identificador ausente ou duplicado.'); seen.add(record.id); }
  };
  unique(state.programs, 'Programa', 'planejamento'); unique(state.actions, 'Ação', 'planejamento');
  unique(state.budgetItems, 'Item OBZ', 'obz'); unique(state.projectMaps || [], 'Mapa do projeto', 'mapas');
  const programs = new Map(state.programs.map((record) => [record.id, record]));
  const actions = new Map(state.actions.map((record) => [record.id, record]));
  const items = new Map(state.budgetItems.map((record) => [record.id, record]));
  const projectIds = new Set<string>();
  for (const action of state.actions) if (!programs.has(action.programaId)) add('acao-sem-programa','erro','planejamento',action.id,'Ação ' + action.codigo + ': programa associado não encontrado.');
  for (const map of state.projectMaps || []) {
    if (projectIds.has(map.projectId)) add('mapa-duplicado','erro','mapas',map.id,'Projeto com mais de um mapa lógico compartilhado.');
    projectIds.add(map.projectId);
    if (!programs.has(map.ownerProgramId)) add('mapa-sem-responsavel','aviso','mapas',map.id,'Programa responsável pelo mapa não encontrado.');
    for (const id of map.actionIds) if (!actions.has(id)) add('participacao-sem-acao','aviso','mapas',map.id,'Uma ação participante do projeto não está na base atual.');
    unique(map.components,'Componente','mapas'); unique(map.indicators,'Indicador do mapa','mapas');
    const components = new Set(map.components.map((record) => record.id));
    for (const indicator of map.indicators) if (indicator.links.some((link) => !components.has(link.componentId))) add('indicador-sem-componente','aviso','mapas',indicator.id,'Indicador ' + indicator.name + ': um componente acompanhado foi removido da proposta.');
    for (const component of map.components) if (component.actionIds.some((id) => !map.actionIds.includes(id))) add('componente-fora-projeto','erro','mapas',component.id,'Componente associado a ação não participante do projeto.');
  }
  const totals = { pending: 0, missingYear: 0, missingTotal: 0 };
  for (const item of state.budgetItems) {
    if (!item.exercise) totals.missingYear++;
    if (effectiveBudgetTotal(item) == null) totals.missingTotal++;
    if (item.linkage?.status !== 'vinculado') { totals.pending++; continue; }
    const action = actions.get(item.actionId), program = programs.get(item.programaId);
    if (!action || !program || action.programaId !== item.programaId || item.exercise !== state.planning?.exercise ||
      codeOf(action.codigo) !== codeOf(item.acaoLabel) || codeOf(program.codigo) !== codeOf(item.programaCodigo || item.source?.programLabel) ||
      unitCode(action.codigoUnidadeOrcamentaria || action.unidadeOrcamentaria) !== unitCode(item.codigoUnidadeOrcamentaria || item.unidadeOrcamentaria)) {
      add('obz-vinculo-incompativel','erro','obz',item.id,'Item OBZ com vínculo confirmado incompatível com exercício, programa, UO ou ação.');
    }
  }
  const uncertain = state.budgetItems.filter((item) => item.validationNeedsReview).length;
  if (uncertain) add('cofin-sem-origem','aviso','obz','base-obz',uncertain + ' decisões de cota anteriores precisam de conferência. Os valores antigos estão preservados, sem confirmação automática.');
  if (totals.pending) add('obz-pendente','informacao','obz','base-obz',totals.pending + ' itens OBZ sem vínculo confirmado. Permanecem na base independente e não bloqueiam o planejamento qualitativo.');
  if (totals.missingYear) add('obz-sem-exercicio','aviso','obz','base-obz',totals.missingYear + ' itens OBZ com exercício não informado na origem ou na proposta.');
  if (totals.missingTotal) add('obz-sem-total','aviso','obz','base-obz',totals.missingTotal + ' itens OBZ sem valor total informado.');
  for (const link of state.links) {
    const item = items.get(link.budgetItemId);
    if (!item) add('coerencia-sem-item','aviso','obz',link.id,'Associação de coerência aponta para item OBZ não encontrado.');
    else if (item.linkage?.status !== 'vinculado' || link.actionId !== item.actionId) add('coerencia-sem-vinculo','aviso','obz',link.id,'Associação de coerência exige revisão do vínculo programático do item OBZ.');
  }
  return findings;
}
