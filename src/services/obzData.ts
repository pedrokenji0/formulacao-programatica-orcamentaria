import type { AppState, BudgetItemOBZ, BudgetSource, BudgetLinkage, Program, Action, SelectionLists } from '../types/index.ts';

export const OBZ_DATA_VERSION = 1;
export const OBZ_BACKUP_KEY = 'fpo-state-v2-before-obz-integrity';
export const OBZ_FIELD_ALIASES: Record<string, string[]> = {
  unidadeOrcamentaria: ['UNIDADE ORÇAMENTÁRIA', 'UO'], programa: ['PROGRAMA'], acao: ['AÇÃO'],
  exercise: ['EXERCÍCIO', 'EXERCÍCIO ORÇAMENTÁRIO', 'ANO'], grupo: ['GRUPO'],
  elementoItem: ['ELEMENTO ITEM', 'ELEMENTO-ITEM', 'ELEMENTO_ITEM'], agrupamento: ['AGRUPAMENTO'],
  fonte: ['FONTE'], descricao: ['DESCRIÇÃO DO ITEM'], premissaVolume: ['PREMISSA VOLUME'],
  volume: ['VOLUME'], premissaPreco: ['PREMISSA DE PREÇO'], precoUnitario: ['PREÇO UNITÁRIO'],
  frequencia: ['FREQUÊNCIA PAGAMENTO', 'FREQUÊNCIA'], valorTotal: ['VALOR TOTAL ITEM'],
  classificacao: ['CLASSIFICAÇÃO CENÁRIO'], novo: ['NOVO?', 'NOVO'], descricaoCenario: ['DESCRIÇÃO DO CENÁRIO'],
  risco: ['RISCO DE NÃO FAZER'], beneficio: ['BENEFICIO AO FAZER'], pN3: ['PRIORIDADE N3'],
  pN2: ['PRIORIDADE N2'], pN1: ['PRIORIDADE N1'], parecer: ['PARECER DCMEFO'], deliberacao: ['DELIBERAÇÃO COFIN'],
};
export const OBZ_FIELD_LABELS: Record<string, string> = {
  unidadeOrcamentaria: 'Unidade orçamentária', programa: 'Programa', acao: 'Ação', exercise: 'Exercício',
  grupo: 'Grupo', elementoItem: 'Elemento-item', agrupamento: 'Agrupamento', fonte: 'Fonte',
  descricao: 'Descrição do item', premissaVolume: 'Premissa de volume', volume: 'Volume',
  premissaPreco: 'Premissa de preço', precoUnitario: 'Preço unitário', frequencia: 'Frequência de pagamento',
  valorTotal: 'Valor total declarado', classificacao: 'Cenário', novo: 'Novo?', descricaoCenario: 'Descrição do cenário',
  risco: 'Risco de não fazer', beneficio: 'Benefício ao fazer', pN3: 'Prioridade N3', pN2: 'Prioridade N2',
  pN1: 'Prioridade N1', parecer: 'Parecer DCMEFO', deliberacao: 'Deliberação COFIN',
};
export const text = (value: unknown) => value == null ? '' : String(value).trim();
export const normalizeHeader = (value: unknown) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ');
export function codeOf(value: unknown): string {
  const found = text(value).match(/^\s*(\d+)(?=\s|[-—–.]|$)/)?.[1];
  return found ? found.replace(/^0+(?=\d)/, '') : '';
}
const UNIT_ALIASES: Record<string, string> = {
  FES: '4291', SES: '4291', 'FES/SES': '4291', FUNED: '2261', FHEMIG: '2271', ESPMG: '1541', HEMOMINAS: '2321',
};
export const unitCode = (value: unknown) => codeOf(value) || UNIT_ALIASES[normalizeHeader(value)] || '';
export function exerciseOf(value: unknown): string | null {
  const candidate = text(value);
  return /^\d{4}$/.test(candidate) && Number(candidate) >= 1900 && Number(candidate) <= 2200 ? candidate : null;
}
export function parseBudgetNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let raw = text(value).replace(/^R\$\s*/, '').replace(/[\s\u00a0]/g, '');
  if (!raw) return null;
  if (/^\(.*\)$/.test(raw)) raw = '-' + raw.slice(1, -1);
  if (!/^[+-]?\d[\d.,]*$/.test(raw)) return null;
  if (raw.includes(',') && raw.includes('.')) {
    const commaDecimal = raw.lastIndexOf(',') > raw.lastIndexOf('.');
    const grouped = commaDecimal ? /^[+-]?\d{1,3}(\.\d{3})*,\d+$|^[+-]?\d+,\d+$/ : /^[+-]?\d{1,3}(,\d{3})*\.\d+$|^[+-]?\d+\.\d+$/;
    if (!grouped.test(raw)) return null;
    raw = commaDecimal ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (raw.includes(',')) {
    if (!/^[+-]?\d+,\d+$/.test(raw)) return null;
    raw = raw.replace(',', '.');
  } else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '');
  else if (!/^[+-]?\d+(\.\d+)?$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}
export function calculateBudgetTotal(volume: number | null, price: number | null, frequency: number | null): number | null {
  if (volume == null || price == null || frequency == null || ![volume, price, frequency].every(Number.isFinite)) return null;
  const value = volume * price * frequency;
  return Number.isFinite(value) ? value : null;
}
export function effectiveBudgetTotal(item: BudgetItemOBZ): number | null {
  return item.totalMode === 'ausente' ? null : Number.isFinite(item.valorTotal) ? item.valorTotal : null;
}
export function autoMapBudgetHeaders(headers: unknown[]) {
  const result: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(OBZ_FIELD_ALIASES)) {
    const column = headers.findIndex((header) => aliases.some((alias) => normalizeHeader(alias) === normalizeHeader(header)));
    if (column >= 0) result[field] = column;
  }
  return result;
}
export function reconcileBudgetItem(item: BudgetItemOBZ, catalog: { programs: Program[]; actions: Action[]; exercise?: string }): BudgetItemOBZ {
  const next = structuredClone(item);
  const programCode = codeOf(next.programaCodigo || next.source?.programLabel);
  const actionCode = codeOf(next.acaoLabel || next.source?.actionLabel);
  const unit = unitCode(next.codigoUnidadeOrcamentaria || next.unidadeOrcamentaria);
  const exercise = exerciseOf(next.exercise);
  const program = catalog.programs.filter((record) => codeOf(record.codigo) === programCode);
  const candidates = catalog.actions.filter((record) =>
    program.some((candidate) => candidate.id === record.programaId) && codeOf(record.codigo) === actionCode &&
    unit && unitCode(record.codigoUnidadeOrcamentaria || record.unidadeOrcamentaria) === unit);
  const issues: string[] = [];
  if (!programCode) issues.push('Programa de origem não identificado.');
  if (!actionCode) issues.push('Ação de origem não identificada.');
  if (!unit) issues.push('UO de origem não identificada.');
  if (!exercise) issues.push('Exercício OBZ não informado. Nenhum exercício foi deduzido do nome do arquivo.');
  let status: BudgetLinkage['status'] = 'pendente';
  if (exercise && catalog.exercise && exercise !== catalog.exercise) {
    status = 'outro-exercicio'; issues.push('Exercício OBZ diferente da base de planejamento.');
  } else if (candidates.length > 1) { status = 'ambiguo'; issues.push('Mais de uma ação corresponde ao programa, UO e código.'); }
  else if (programCode && actionCode && unit && !candidates.length) { status = 'sem-correspondencia'; issues.push('Programa, UO e ação sem correspondência exata na base atual.'); }
  else if (candidates.length === 1 && exercise && catalog.exercise === exercise) status = 'vinculado';
  next.programaId = status === 'vinculado' ? candidates[0].programaId : '';
  next.actionId = status === 'vinculado' ? candidates[0].id : '';
  next.programaCodigo = programCode;
  next.codigoUnidadeOrcamentaria = unit;
  next.exercise = exercise;
  next.linkage = { status, candidates: candidates.map((record) => record.id), issues };
  return next;
}

export interface BudgetImportOptions { batchId: string; file: string; sheet: string; exercise?: string; headers: string[]; rowOffset?: number }
export function buildBudgetImport(rows: unknown[][], headerIndex: number, mapping: Record<string, number | undefined>, options: BudgetImportOptions, catalog: { programs: Program[]; actions: Action[]; exercise?: string }) {
  if (!options.batchId) throw new Error('Identificador do lote ausente.');
  if (mapping.acao == null || mapping.descricao == null) throw new Error('Mapeie ação e descrição do item.');
  const mapped = Object.values(mapping).filter((value): value is number => value != null);
  if (new Set(mapped).size !== mapped.length) throw new Error('Uma coluna não pode alimentar dois campos diferentes.');
  const lists: Partial<SelectionLists> = { programas: [], acoes: [], grupos: [], elementosItens: [], agrupamentos: [], fontes: [], unidades: [] };
  const items: BudgetItemOBZ[] = [];
  const issues: string[] = [];
  let ignored = 0;
  for (let index = headerIndex + 1; index < rows.length; index++) {
    const row = rows[index] || [];
    if (!row.some((value) => text(value))) continue;
    const get = (field: string) => mapping[field] == null ? '' : row[mapping[field]!];
    const description = text(get('descricao')), actionLabel = text(get('acao'));
    if (!description || !actionLabel) { ignored++; issues.push('Linha ' + (index + 1) + ': ação ou descrição ausente; não importada.'); continue; }
    const numbers: Record<string, number | null> = {};
    const dataIssues: string[] = [];
    for (const field of ['volume', 'precoUnitario', 'frequencia', 'valorTotal', 'pN3', 'pN2', 'pN1']) {
      numbers[field] = parseBudgetNumber(get(field));
      if (text(get(field)) && numbers[field] == null) dataIssues.push(OBZ_FIELD_LABELS[field] + ': número inválido na origem.');
    }
    const calculated = calculateBudgetTotal(numbers.volume, numbers.precoUnitario, numbers.frequencia);
    const declared = numbers.valorTotal;
    if (declared != null && calculated != null && Math.abs(declared - calculated) > 0.01) dataIssues.push('Valor declarado difere de volume × preço × frequência.');
    const classification = normalizeHeader(get('classificacao'));
    const scenario = classification === 'LIMIAR' || classification === 'INCREMENTAL' ? classification : 'NÃO INFORMADO';
    if (scenario === 'NÃO INFORMADO') dataIssues.push('Cenário ausente ou não reconhecido.');
    const rawExercise = get('exercise'), originalExercise = exerciseOf(rawExercise);
    if (text(rawExercise) && !originalExercise) dataIssues.push('Exercício inválido na origem.');
    const source: BudgetSource = {
      kind: 'planilha', batchId: options.batchId, file: options.file, sheet: options.sheet, row: index + 1 + (options.rowOffset || 0),
      unitLabel: text(get('unidadeOrcamentaria')), programLabel: text(get('programa')), actionLabel,
      exercise: originalExercise, raw: { headers: options.headers, cells: structuredClone(row) }, numbers,
    };
    const item: BudgetItemOBZ = {
      id: 'obz-import:' + options.batchId + ':' + encodeURIComponent(options.sheet) + ':' + (index + 1 + (options.rowOffset || 0)),
      unidadeOrcamentaria: source.unitLabel, codigoUnidadeOrcamentaria: unitCode(source.unitLabel),
      programaId: '', actionId: '', acaoLabel: actionLabel, exercise: originalExercise || (text(rawExercise) ? null : exerciseOf(options.exercise)),
      quantities: { volume: numbers.volume, precoUnitario: numbers.precoUnitario, frequenciaPagamento: numbers.frequencia },
      source, dataIssues, totalMode: declared != null ? 'declarado' : calculated != null ? 'calculado' : 'ausente',
      grupo: text(get('grupo')), elemento: 'ELEMENTO', elementoItem: text(get('elementoItem')),
      agrupamento: text(get('agrupamento')), fonte: text(get('fonte')), descricao: description,
      premissaVolume: text(get('premissaVolume')), volume: numbers.volume ?? 0, premissaPreco: text(get('premissaPreco')),
      precoUnitario: numbers.precoUnitario ?? 0, frequenciaPagamento: numbers.frequencia ?? 0,
      valorTotal: declared ?? calculated ?? 0, classificacaoCenario: scenario,
      novo: /^(sim|true|1)$/i.test(text(get('novo'))), descricaoCenario: text(get('descricaoCenario')),
      riscoNaoFazer: text(get('risco')), beneficioAoFazer: text(get('beneficio')),
      prioridadeN3: numbers.pN3 ?? 0, prioridadeN2: numbers.pN2 ?? 0, prioridadeN1: numbers.pN1 ?? 0,
      observacoes: '', parecerDcmefoOriginal: get('parecer'), deliberacaoCofinOriginal: get('deliberacao'),
      statusValidacao: 'EM PREENCHIMENTO',
    };
    items.push(reconcileBudgetItem(item, catalog));
    for (const [key, field] of [['programas', 'programa'], ['acoes', 'acao'], ['grupos', 'grupo'], ['elementosItens', 'elementoItem'], ['agrupamentos', 'agrupamento'], ['fontes', 'fonte'], ['unidades', 'unidadeOrcamentaria']] as const) {
      const value = text(get(field)); if (value && !lists[key]!.includes(value)) lists[key]!.push(value);
    }
  }
  return { items, lists, issues, ignored, linked: items.filter((item) => item.linkage?.status === 'vinculado').length };
}
export function applyBudgetImport(state: AppState, items: BudgetItemOBZ[]) {
  if (!['Técnico do Órgão', 'Validador do Órgão', 'Gestor UA', 'Gestor Setorial', 'Central Geral', 'Administrador'].includes(state.perfil)) throw new Error('Perfil sem permissão para importar OBZ.');
  const ids = new Set(state.budgetItems.map((item) => item.id));
  const additions: BudgetItemOBZ[] = [];
  let skipped = 0;
  for (const item of items) {
    if (ids.has(item.id)) { skipped++; continue; }
    if (state.perfil === 'Gestor UA' && (!unitCode(state.unidade) || unitCode(state.unidade) !== unitCode(item.codigoUnidadeOrcamentaria || item.unidadeOrcamentaria))) throw new Error('O lote contém itens de outra UO.');
    ids.add(item.id); additions.push(structuredClone(item));
  }
  state.budgetItems.push(...additions);
  return { added: additions.length, skipped };
}

export function migrateBudgetData(state: AppState, baseline: AppState): AppState {
  if (state.planning?.obzDataVersion === OBZ_DATA_VERSION) return state;
  let corrected = 0;
  const originals = new Map(baseline.budgetItems.map((item) => [item.id, item]));
  state.budgetItems = state.budgetItems.map((record) => {
    const next = structuredClone(record), initial = originals.get(record.id);
    next.legacyIdentity ||= { programaId: next.programaId, actionId: next.actionId, unidadeOrcamentaria: next.unidadeOrcamentaria };
    if (initial?.source && unitCode(next.unidadeOrcamentaria) === '4291' && unitCode(initial.unidadeOrcamentaria) !== '4291') {
      next.unidadeOrcamentaria = initial.unidadeOrcamentaria;
      next.codigoUnidadeOrcamentaria = unitCode(initial.unidadeOrcamentaria); corrected++;
    }
    if (!next.source && initial?.source) {
      next.source = structuredClone(initial.source);
      // These labels were generated by the old seed adapter for all five UOs.
      next.codigoUnidadeOrcamentaria = unitCode(next.unidadeOrcamentaria);
      next.totalMode ||= 'declarado';
      next.exercise = null;
    }
    if (!next.source) next.source = {
      kind: 'legado', batchId: 'legado-sem-origem', file: '', sheet: '', row: 0,
      unitLabel: next.unidadeOrcamentaria, programLabel: '', actionLabel: next.acaoLabel,
      exercise: null, raw: { legacyIdentity: next.legacyIdentity }, numbers: {},
    };
    return reconcileBudgetItem(next, { programs: state.programs, actions: state.actions, exercise: state.planning?.exercise });
  });
  const budgets = new Map(state.budgetItems.map((item) => [item.id, item]));
  state.links = (state.links || []).map((link) => {
    const item = budgets.get(link.budgetItemId);
    if (item?.linkage?.status === 'vinculado' && item.actionId === link.actionId) return link;
    return { ...link, status: 'Inconsistente', warnings: [...new Set([...(link.warnings || []), 'O item OBZ exige conferência de exercício, programa, UO e ação antes de confirmar esta associação.'])] };
  });
  if (state.planning) {
    state.planning.obzDataVersion = OBZ_DATA_VERSION;
    state.planning.migrationNotices = [...new Set([...(state.planning.migrationNotices || []),
      'OBZ: origem preservada e vínculos reavaliados por exercício, programa, UO e ação. Itens sem correspondência permanecem na base OBZ, disponíveis no filtro de pendências.',
      ...(corrected ? [corrected + ' itens da Saúde tiveram a UO recuperada da origem. A identificação anterior está preservada no registro e no backup.'] : []),
    ])];
  }
  return state;
}

export function createHealthBudgetItems(seed: { obzItems: Record<string, any>[]; healthActions: Record<string, any>[] }): BudgetItemOBZ[] {
  const labels = new Map(seed.healthActions.map((action) => [unitCode(action.codigoUnidadeAcao), action.unidadeAcao]));
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24);
  return seed.obzItems.map((row, index) => {
    const code = unitCode(row.uo);
    const unit = code ? code.padStart(5, '0') + ' - ' + (labels.get(code) || text(row.uo)) : text(row.uo);
    const numbers: Record<string, number | null> = {};
    for (const key of ['volume', 'precoUnitario', 'frequencia', 'valorTotal', 'pN3', 'pN2', 'pN1']) numbers[key] = parseBudgetNumber(row[key]);
    const declared = numbers.valorTotal, calculated = calculateBudgetTotal(numbers.volume, numbers.precoUnitario, numbers.frequencia);
    const source: BudgetSource = { kind: 'seed-saude', batchId: 'seed-health-v1', file: '4291.xlsx', sheet: 'BASE OBZ', row: Number.isInteger(row.sourceRow) ? row.sourceRow : 0,
      unitLabel: text(row.uo), programLabel: text(row.programa), actionLabel: text(row.acao), exercise: null,
      raw: { ...structuredClone(row), seedIndex: index }, numbers };
    const scenario = normalizeHeader(row.classificacao);
    return {
      id: 'obz-' + slug(text(row.org)) + '-' + codeOf(row.acao) + '-' + index,
      unidadeOrcamentaria: unit, codigoUnidadeOrcamentaria: code, programaCodigo: codeOf(row.programa),
      programaId: '', actionId: '', acaoLabel: text(row.acao), exercise: null, source,
      quantities: { volume: numbers.volume, precoUnitario: numbers.precoUnitario, frequenciaPagamento: numbers.frequencia },
      totalMode: declared != null ? 'declarado' : calculated != null ? 'calculado' : 'ausente',
      grupo: text(row.grupo), elemento: 'ELEMENTO', elementoItem: text(row.elemento), agrupamento: text(row.agrupamento),
      fonte: text(row.fonte), descricao: text(row.descricao), premissaVolume: text(row.premissaVolume),
      volume: numbers.volume ?? 0, premissaPreco: text(row.premissaPreco), precoUnitario: numbers.precoUnitario ?? 0,
      frequenciaPagamento: numbers.frequencia ?? 0, valorTotal: declared ?? calculated ?? 0,
      classificacaoCenario: scenario === 'LIMIAR' || scenario === 'INCREMENTAL' ? scenario : 'NÃO INFORMADO',
      novo: !!row.novo, descricaoCenario: text(row.descricaoCenario), riscoNaoFazer: text(row.risco), beneficioAoFazer: text(row.beneficio),
      prioridadeN3: numbers.pN3 ?? 0, prioridadeN2: numbers.pN2 ?? 0, prioridadeN1: numbers.pN1 ?? 0,
      observacoes: 'N2: ' + (row.n2 || '-') + ' | N3: ' + (row.n3 || '-'),
      parecerDcmefoOriginal: row.parecerDcmefo, deliberacaoCofinOriginal: row.deliberacaoCofin,
      dataIssues: declared != null && calculated != null && Math.abs(declared - calculated) > 0.01 ? ['Valor declarado difere de volume × preço × frequência.'] : [],
      statusValidacao: 'EM PREENCHIMENTO',
    };
  });
}
export function budgetItemIssues(item: BudgetItemOBZ): string[] {
  const issues = [...(item.linkage?.issues || [])];
  if (!item.descricao.trim()) issues.push('Descrição não informada.');
  if (!item.grupo) issues.push('Grupo não informado.');
  if (!item.elementoItem) issues.push('Elemento-item não informado.');
  if (!item.fonte) issues.push('Fonte não informada.');
  if (effectiveBudgetTotal(item) == null) issues.push('Valor total não informado.');
  if (item.classificacaoCenario === 'NÃO INFORMADO') issues.push('Cenário não informado.');
  return [...new Set(issues)];
}
export function enforceBudgetUpdate(previous: AppState, next: AppState) {
  if (new Set(next.budgetItems.map((item) => item.id)).size !== next.budgetItems.length) throw new Error('Identificadores OBZ duplicados.');
  const originals = new Map(previous.budgetItems.map((item) => [item.id, item]));
  for (const item of next.budgetItems) {
    const old = originals.get(item.id);
    if (JSON.stringify(old) === JSON.stringify(item)) continue;
    if (old?.source && JSON.stringify(old.source) !== JSON.stringify(item.source)) throw new Error('Origem OBZ protegida. Edite a proposta, preservando a linha original.');
    if (['volume','precoUnitario','frequenciaPagamento','valorTotal','prioridadeN3','prioridadeN2','prioridadeN1'].some((key) => { const value = (item as unknown as Record<string, unknown>)[key]; return typeof value !== 'number' || !Number.isFinite(value); })) throw new Error('Número OBZ inválido.');
    if (item.linkage?.status === 'vinculado') {
      const action = next.actions.find((record) => record.id === item.actionId);
      const program = next.programs.find((record) => record.id === item.programaId);
      if (!action || !program || codeOf(program.codigo) !== codeOf(item.programaCodigo || item.source?.programLabel) || action.programaId !== item.programaId ||
          unitCode(action.codigoUnidadeOrcamentaria || action.unidadeOrcamentaria) !== unitCode(item.codigoUnidadeOrcamentaria || item.unidadeOrcamentaria) ||
          codeOf(action.codigo) !== codeOf(item.acaoLabel) || item.exercise !== next.planning?.exercise) throw new Error('Vínculo OBZ incompatível com exercício, programa, UO ou ação.');
    }
  }
}

export function budgetPriorityIssues(items: BudgetItemOBZ[]): string[] {
  const used = new Set<string>(), issues: string[] = [];
  for (const item of items) {
    for (const key of ['prioridadeN3','prioridadeN2','prioridadeN1'] as const) {
      const value = item[key];
      if (item.classificacaoCenario === 'LIMIAR') { if (value !== 0) issues.push(item.descricao + ': prioridade em item limiar deve ser zero.'); continue; }
      if (item.classificacaoCenario !== 'INCREMENTAL') continue;
      if (!Number.isInteger(value) || value < 1 || value > 10) { issues.push(item.descricao + ': prioridade incremental deve ser inteira entre 1 e 10.'); continue; }
      const scope = JSON.stringify([item.exercise, item.programaCodigo || codeOf(item.source?.programLabel), unitCode(item.codigoUnidadeOrcamentaria || item.unidadeOrcamentaria), codeOf(item.acaoLabel), key, value]);
      if (used.has(scope)) issues.push(item.descricao + ': prioridade repetida na mesma ação, UO e exercício.');
      used.add(scope);
    }
  }
  return issues;
}
