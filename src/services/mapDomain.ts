import type { ProcessAction, ProcessMap, MapItem } from '../types';

export const MAP_ITEM_LIMIT = 8;
export type ActionItemSection = 'recursos' | 'atividades' | 'produtos' | 'resultados' | 'impactos';
export type ActionEditorSection = Exclude<ActionItemSection, 'produtos'> | 'produtoPrincipal' | 'produtosSecundarios';

export function principalProduct(action: ProcessAction) {
  return action.produtos.find((item) => item.productRole === 'principal') || action.produtos.find((item) => !item.productRole);
}

export function secondaryProducts(action: ProcessAction) {
  const principal = principalProduct(action);
  return action.produtos.filter((item) => item.id !== principal?.id);
}

export const itemSection = (section: ActionEditorSection): ActionItemSection => section === 'produtoPrincipal' || section === 'produtosSecundarios' ? 'produtos' : section;
export function editorItems(action: ProcessAction, section: ActionEditorSection): MapItem[] {
  if (section === 'produtoPrincipal') return principalProduct(action) ? [principalProduct(action)!] : [];
  if (section === 'produtosSecundarios') return secondaryProducts(action);
  return action[section] || [];
}
export const editorLimit = (section: ActionEditorSection) => section === 'produtoPrincipal' ? 1 : section === 'produtosSecundarios' ? MAP_ITEM_LIMIT - 1 : MAP_ITEM_LIMIT;
export function canAddActionItem(action: ProcessAction, section: ActionEditorSection) {
  return editorItems(action, section).length < editorLimit(section) && (itemSection(section) !== 'produtos' || action.produtos.length < MAP_ITEM_LIMIT);
}
function preserveProductRoles(action: ProcessAction) {
  const principal = principalProduct(action);
  action.produtos.forEach((item) => { item.productRole = item.id === principal?.id ? 'principal' : 'secundario'; });
}
export function addActionItem(action: ProcessAction, section: ActionEditorSection, item: MapItem) {
  if (!item.texto.trim() || !canAddActionItem(action, section)) return false;
  const key = itemSection(section);
  if (key === 'produtos') preserveProductRoles(action);
  action[key] ||= [];
  action[key]!.push({ ...item, ...(key === 'produtos' ? { productRole: section === 'produtoPrincipal' ? 'principal' as const : 'secundario' as const } : {}) });
  return true;
}
export function setActionLink(action: ProcessAction, section: 'recursos' | 'atividades', sourceId: string, targetId: string, selected: boolean) {
  const source = action[section].find((item) => item.id === sourceId);
  const targetSection = section === 'recursos' ? 'atividades' : 'produtos';
  const kind = section === 'recursos' ? 'atividade' : 'produto';
  if (!source || !action[targetSection].some((item) => item.id === targetId)) return false;
  source.associations = (source.associations || []).filter((link) => !(link.componentId === targetId && link.kind === kind && link.actionId === action.id));
  if (selected) source.associations.push({ kind, actionId: action.id, componentId: targetId });
  return true;
}
export function removeActionItem(map: ProcessMap, actionId: string, section: ActionItemSection, itemId: string) {
  const action = map.actions.find((record) => record.id === actionId);
  if (!action) return;
  if (section === 'produtos') preserveProductRoles(action);
  action[section] = (action[section] || []).filter((item) => item.id !== itemId);
  const items = [...map.contexto, ...(map.premissas || []), ...(map.causas || []), ...map.resultados, ...map.impactos,
    ...map.actions.flatMap((record) => [...record.recursos, ...record.atividades, ...record.produtos, ...(record.resultados || []), ...(record.impactos || []), ...record.pressupostos, ...record.riscos])];
  items.forEach((item) => { if (item.associations) item.associations = item.associations.filter((link) => !(link.componentId === itemId && link.actionId === actionId)); });
}
