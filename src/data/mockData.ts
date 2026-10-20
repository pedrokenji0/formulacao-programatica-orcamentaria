import { createHealthBudgetItems, unitCode } from '../services/obzData';
import seedRaw from '../../scripts/seed.health.json';
import type {
  AppState, Program, Action, BudgetItemOBZ, LogicalFramework, ProcessMap,
  Mirror, SelectionLists, SupportList,
} from '../types';

const seed: any = seedRaw;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24);
const codeOf = (s: string) => (s.match(/^\s*([\w.]+)/)?.[1] || s).trim();
const programCodeOf = (s: string) => {
  const digits = codeOf(s).match(/\d+/)?.[0] || '';
  return digits ? String(Number(digits)).padStart(3, '0') : codeOf(s);
};
const actionCodeOf = (s: string) => {
  const digits = codeOf(s).match(/\d+/)?.[0] || '';
  return digits ? String(Number(digits)) : codeOf(s);
};
const labelOfUo = (codigo?: string, nome?: string) => {
  const c = String(codigo || '').replace(/^0+/, '') || String(codigo || '');
  return `${c} - ${nome || 'Unidade orçamentária'}`;
};
const uoLabel: Record<string, string> = {
  'FES/SES': '4291 — Fundo Estadual de Saúde (SES)',
  SEJUSP: '1451 — Sec. de Justiça e Segurança Pública (SEJUSP)',
  SEE: '1261 — Secretaria de Estado de Educação (SEE)',
  SEPLAG: '1501 — Secretaria de Planejamento e Gestão (SEPLAG)',
};

// ---------------------------------------------------------------------------
// Programas/Ações/OBZ reais a partir do seed (4 órgãos)
// ---------------------------------------------------------------------------
const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));
const programs: Program[] = [];
const actions: Action[] = [];
const budgetItems: BudgetItemOBZ[] = [];

const progIndex = new Map<string, string>(); // progcod -> programId
const actIndex = new Map<string, string>();  // progcod|acaocod -> actionId

const upsertProgram = (pCode: string, nome: string, data: any = {}) => {
  let programId = progIndex.get(pCode);
  if (!programId) {
    programId = `prog-saude-${pCode}`;
    progIndex.set(pCode, programId);
    programs.push({
      id: programId,
      codigo: pCode,
      nome,
      unidadeAdministrativa: data.unidadeAdministrativa || '',
      unidadeOrcamentaria: data.unidadeOrcamentaria || '4291 - Fundo Estadual de Saúde (SES)',
      orgao: data.orgao || 'SAÚDE',
      areaTematica: data.areaTematica || 'Saúde',
      problemaCentral: '',
      objetivo: '',
      justificativa: data.justificativa || '',
      publicoAlvo: '',
      contexto: '',
      horizonteTemporal: '',
      tipoPrograma: '',
      indicador: '',
      resultados: [],
      impactos: [],
      status: 'RASCUNHO',
    });
  }
  return programId;
};

const upsertAction = (programId: string, pCode: string, aCode: string, nome: string, data: any = {}) => {
  const unit = unitCode(data.codigoUnidadeOrcamentaria || data.unidadeOrcamentaria);
  const aKey = `${pCode}|${unit}|${aCode}`;
  let actionId = actIndex.get(aKey);
  if (!actionId) {
    actionId = `act-saude-${pCode}-${unit || 'sem-uo'}-${aCode}`;
    actIndex.set(aKey, actionId);
    actions.push({
      id: actionId,
      codigo: aCode,
      nome,
      programaId: programId,
      unidadeAdministrativa: data.unidadeAdministrativa || '',
      unidadeOrcamentaria: data.unidadeOrcamentaria || '4291 - Fundo Estadual de Saúde (SES)',
      codigoUnidadeOrcamentaria: data.codigoUnidadeOrcamentaria || '',
      orgao: data.orgao || 'SAÚDE',
      codigoOrgao: data.codigoOrgao || '',
      funcao: data.funcao || '',
      subfuncao: data.subfuncao || '',
      tipoAcao: data.tipoAcao || '',
      iag: data.iag || '',
      publicoAlvo: data.publicoAlvo || '',
      relacaoMulher: data.relacaoMulher || '',
      produto: data.produto || '',
      especificacaoProduto: data.especificacaoProduto || data.especificacao || '',
      codigoProduto: data.codigoProduto || '',
      unidadeMedida: data.unidadeMedida || '',
      finalidade: data.finalidade || '',
      descricao: data.descricao || '',
      detalhamentoImplementacao: data.detalhamentoImplementacao || '',
      baseLegal: data.baseLegal || '',
      status: 'RASCUNHO',
    });
  }
  return actionId;
};

for (const it of ((seed.healthActions as any[]) || [])) {
  const pCode = programCodeOf(it.programaCodigo);
  const aCode = actionCodeOf(it.acaoCodigo);
  const unidadeAcao = labelOfUo(it.codigoUnidadeAcao, it.unidadeAcao);
  const programId = upsertProgram(pCode, it.programaNome, {
    unidadeOrcamentaria: labelOfUo(it.codigoUnidadePrograma, it.unidadePrograma),
    orgao: it.setorGoverno || 'SAÚDE',
    areaTematica: it.areaTematica || 'Saúde',
    justificativa: it.programaJustificativa || '',
  });
  upsertAction(programId, pCode, aCode, it.acaoNome, {
    unidadeAdministrativa: it.unidadeAdministrativa || '',
    unidadeOrcamentaria: unidadeAcao,
    codigoUnidadeOrcamentaria: it.codigoUnidadeAcao || '',
    codigoOrgao: it.codigoUnidadePrograma || '',
    orgao: it.setorGoverno || 'SAÚDE',
    funcao: it.funcao,
    subfuncao: it.subfuncao,
    tipoAcao: it.tipoAcao,
    iag: it.iag,
    publicoAlvo: it.publicoAlvo,
    relacaoMulher: it.politicaMulheres,
    produto: it.produto,
    especificacaoProduto: it.especificacaoProduto,
    codigoProduto: it.produtoCodigo,
    unidadeMedida: it.unidadeMedida,
    finalidade: it.finalidade,
    descricao: it.descricao,
    baseLegal: it.baseLegal,
  });
}

budgetItems.push(...createHealthBudgetItems(seed));

for (const p of programs) {
  const publics = uniq(actions.filter((a) => a.programaId === p.id).map((a) => a.publicoAlvo));
  if (!p.publicoAlvo) p.publicoAlvo = publics.join('; ');
}

const maps: ProcessMap[] = programs.map((p) => ({
  programId: p.id,
  problemaCentral: p.problemaCentral,
  contexto: [],
  premissas: [],
  resultados: [],
  impactos: [],
  actions: actions.filter((a) => a.programaId === p.id).map((a) => ({
    id: a.id,
    codigo: a.codigo,
    nome: a.nome,
    objetivo: a.finalidade || a.descricao || '',
    publicoAlvo: a.publicoAlvo || '',
    recursos: [],
    atividades: [],
    produtos: a.produto ? [{ id: `prod-${a.id}`, texto: a.produto, categoria: a.unidadeMedida ? `Unidade: ${a.unidadeMedida}` : undefined }] : [],
    pressupostos: [],
    riscos: [],
  })),
  status: 'RASCUNHO',
}));

const defaultProgramId = progIndex.get('063') || programs[0]?.id || '';

// ---------------------------------------------------------------------------
// Listas de seleção
// ---------------------------------------------------------------------------
const lists: SelectionLists = {
  unidades: uniq([
    '1261 — Secretaria de Estado de Educação (SEE)',
    '1451 — Sec. de Justiça e Segurança Pública (SEJUSP)', '1501 — Secretaria de Planejamento e Gestão (SEPLAG)',
    '4291 — Fundo Estadual de Saúde (SES)', '1501001 — Central Geral',
  ]),
  programas: uniq([...((seed.lists.programas as string[]) || [])]),
  acoes: uniq([...((seed.lists.acoes as string[]) || [])]),
  grupos: uniq(['3 — Outras Despesas de Custeio', '4 — Investimento', '5 — Inversões Financeiras', ...((seed.lists.grupos as string[]) || [])]),
  elementos: ['ELEMENTO'],
  elementosItens: uniq(['1401 — Diárias civil', '3301 — Passagens', '3903 — Fornecimento de alimentação', '3005 — Material para escritório', '3390 — Serviços de terceiros', ...((seed.lists.elementosItens as string[]) || [])]),
  agrupamentos: uniq(['Diárias e viagens', 'Alimentação', 'Material de consumo', 'Serviços de apoio', ...((seed.lists.agrupamentos as string[]) || [])]),
  fontes: uniq(['10', '60', '71', ...((seed.lists.fontes as string[]) || []).map(String)]),
  funcoes: uniq(['CULTURA', 'EDUCAÇÃO', 'SEGURANÇA PÚBLICA', 'SAÚDE', 'ADMINISTRAÇÃO']),
  subfuncoes: uniq(['DIFUSÃO CULTURAL', 'ENSINO PROFISSIONAL', 'CUSTÓDIA E REINTEGRAÇÃO', 'VIGILÂNCIA EPIDEMIOLÓGICA', 'PLANEJAMENTO E ORÇAMENTO']),
  tiposAcao: uniq(['Atividade Fim do Orçamento Fiscal', 'Atividade Meio do Orçamento Fiscal', 'Projeto']),
  publicos: uniq(['Cidadãos em geral', 'Servidores públicos', 'Agentes culturais', 'Estudantes', 'Trabalhadores da cultura', 'Entidades públicas', 'Terceiro setor', 'Outros']),
  categoriasRecurso: ['Pessoas', 'Materiais/insumos recorrentes', 'Equipamentos e tecnologia', 'Serviços externos', 'Logística', 'Outros'],
  categoriasAtividade: ['Planejamento e gestão', 'Contratações', 'Monitoramento', 'Formação de externos', 'Atendimento ao público', 'Fiscalização'],
  categoriasProduto: ['Serviço prestado', 'Pessoa capacitada', 'Material produzido', 'Bem entregue', 'Evento realizado'],
  periodicidades: ['Mensal', 'Trimestral', 'Semestral', 'Anual'],
  unidadesMedida: ['UNIDADE', 'PESSOA', 'PERCENTUAL', 'SERVIÇO', 'EVENTO'],
  polaridades: ['Quanto maior, melhor', 'Quanto menor, melhor'],
};

// ---------------------------------------------------------------------------
// Tabelas de apoio (admin)
// ---------------------------------------------------------------------------
const supportList = (id: string, nome: string, valores: string[]): SupportList => ({
  id, nome, valores: valores.map((v, i) => ({ id: `${id}-${i}`, label: v, ativo: true })),
  ultimaAlteracao: '2026-02-27', responsavel: 'Administrador',
});

const support = {
  programmatic: [
    supportList('cat-causa', 'Tipos de causas (árvore de problemas)', ['causa estrutural', 'causa maior', 'causa superficial', 'parâmetro externo']),
    supportList('cat-recurso', 'Categorias de recursos', lists.categoriasRecurso),
    supportList('cat-atividade', 'Categorias de atividades', lists.categoriasAtividade),
    supportList('cat-produto', 'Categorias de produtos', lists.categoriasProduto),
    supportList('periodicidade', 'Periodicidades', lists.periodicidades),
    supportList('polaridade', 'Polaridades de indicador', lists.polaridades),
  ],
  budgetary: [
    supportList('uo', 'Unidades orçamentárias', lists.unidades),
    supportList('grupo', 'Grupos de despesa', lists.grupos),
    supportList('elemento-item', 'Elementos-itens', lists.elementosItens),
    supportList('agrupamento', 'Agrupamentos', lists.agrupamentos),
    supportList('fonte', 'Fontes', lists.fontes),
    supportList('funcao', 'Funções', lists.funcoes),
    supportList('subfuncao', 'Subfunções', lists.subfuncoes),
    supportList('tipo-acao', 'Tipos de ação', lists.tiposAcao),
  ],
};

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------
export const initialState: AppState = {
  perfil: 'Técnico do Órgão',
  unidade: '4291 - Fundo Estadual de Saúde (SES)',
  currentProgramId: defaultProgramId,
  programs, actions, frameworks: [], maps, budgetItems, links: [], mirrors: [], support, lists,
};
