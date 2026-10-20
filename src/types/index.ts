// ============================================================================
// Modelos de domínio — Formulação Programática-Orçamentária
// ============================================================================

import type { ActionComplements, ComponentAssociation, OfficialFields, PlanningProposal } from './planning';
import type { ProjectPlanningMap } from './projectMaps';
export type * from './planning';
export type * from './projectMaps';

export type Perfil =
  | 'Consulta'
  | 'Leitor'
  | 'Gestor UA'
  | 'Gestor Setorial'
  | 'Central Geral'
  | 'Técnico do Órgão'
  | 'Validador do Órgão'
  | 'DCMEFO/SEPLAG'
  | 'Administrador';

export type Status =
  | 'NÃO INICIADO'
  | 'RASCUNHO'
  | 'EM PREENCHIMENTO'
  | 'ENVIADO PARA VALIDAÇÃO'
  | 'VALIDADO PELO ÓRGÃO'
  | 'DEVOLVIDO PARA AJUSTES'
  | 'VALIDADO DCMEFO/SEPLAG'
  | 'BLOQUEADO';

export interface Program {
  id: string;
  codigo: string;
  nome: string;
  unidadeAdministrativa?: string;
  unidadeOrcamentaria: string;
  orgao: string;
  areaTematica?: string;
  problemaCentral: string;
  objetivo: string;
  justificativa: string;
  publicoAlvo: string;
  contexto: string;
  horizonteTemporal?: string;
  tipoPrograma?: string;
  indicador?: string;
  causas?: string;
  causeItems?: { id: string; texto: string }[];
  ppoComplements?: Record<string, string>;
  estrategiaImplementacao?: string;
  codigoOrgao?: string;
  codigoUnidadeOrcamentaria?: string;
  resultados: string[];
  impactos: string[];
  status: Status;
  officialFields?: OfficialFields;
  strategicLinks?: OfficialFields[];
  sourceVariants?: OfficialFields[];
  source?: { origin: 'PPO' | 'local'; file: string };
}

export interface Action {
  id: string;
  codigo: string;
  nome: string;
  programaId: string;
  unidadeAdministrativa?: string;
  unidadeOrcamentaria: string;
  codigoUnidadeOrcamentaria?: string;
  orgao: string;
  codigoOrgao?: string;
  funcao: string;
  subfuncao: string;
  tipoAcao: string;
  iag: string;
  publicoAlvo: string;
  relacaoMulher?: string;
  produto: string;
  especificacaoProduto: string;
  codigoProduto?: string;
  codigoProjetoEstrategico?: string;
  projetoEstrategico?: string;
  unidadeMedida: string;
  finalidade: string;
  descricao: string;
  detalhamentoImplementacao?: string;
  baseLegal: string;
  status: Status;
  officialFields?: OfficialFields;
  sourceVariants?: OfficialFields[];
  source?: { origin: 'PPO' | 'local'; file: string };
  local?: ActionComplements;
}

// ---- Marco Lógico ----
export type ProblemNodeType =
  | 'causa estrutural'
  | 'causa maior'
  | 'causa superficial'
  | 'problema central'
  | 'consequência direta'
  | 'consequência final'
  | 'parâmetro externo';

export interface ProblemNode {
  id: string;
  text: string;
  type: ProblemNodeType;
  parentId: string | null;
  evidence: string;
  isModifiable: 'sim' | 'não' | 'parcial';
  isParameter: boolean;
  notes: string;
}

export type ObjectiveNodeType =
  | 'objetivo central'
  | 'meio'
  | 'fim'
  | 'parâmetro externo';

export interface ObjectiveNode {
  id: string;
  text: string;
  problemNodeId: string | null;
  type: ObjectiveNodeType;
  parentId: string | null;
  isParameter: boolean;
  notes: string;
}

export interface InvolvedActor {
  id: string;
  nome: string;
  papel: string;
  interesse: string;
  influencia: 'baixa' | 'média' | 'alta';
  posicao: 'apoia' | 'neutro' | 'resiste';
}

export interface Alternative {
  id: string;
  meio: string;
  acaoPossivel: string;
  produtoPossivel: string;
  atividadeAssociada: string;
  custo: 'baixo' | 'médio' | 'alto';
  tempoImplementacao: string;
  capacidadeOperacional: string;
  impactoPotencial: string;
  viabilidade: string;
  aderenciaPpag: string;
  observacoes: string;
  scores: Record<string, number>; // criterioId -> nota 1..5
}

export interface DecisionCriterion {
  id: string;
  nome: string;
  peso: number;
}

export interface ProblemTheory {
  territorio: string;
  publicoAfetado: string;
  problemaCentral: string;
  situacaoAtual: string;
  evidencias: string;
  fonteEvidencias: string;
  justificativa: string;
  hipotesesCausais: string;
  limitacoesExternas: string;
  situacaoFutura: string;
  observacoes: string;
}

export interface LogicalFramework {
  programId: string;
  problemTheory: ProblemTheory;
  involvedActors: InvolvedActor[];
  problemNodes: ProblemNode[];
  objectiveNodes: ObjectiveNode[];
  alternatives: Alternative[];
  criteria: DecisionCriterion[];
  selectedAlternativeId: string | null;
  synthesis: string;
  status: Status;
}

// ---- Mapa de Processos e Resultados ----
export interface MapItem {
  id: string;
  texto: string;
  categoria?: string;
  publicos?: string[];
  preProduto?: string;
  productRole?: 'principal' | 'secundario';
  origin?: 'importado' | 'sugestao' | 'confirmado' | 'local';
  sourceReference?: string;
  associations?: ComponentAssociation[];
}

export interface ProcessAction {
  id: string;
  codigo: string;
  nome: string;
  objetivo: string;
  publicoAlvo: string;
  recursos: MapItem[];
  atividades: MapItem[];
  produtos: MapItem[];
  resultados?: MapItem[];
  impactos?: MapItem[];
  pressupostos: MapItem[];
  riscos: MapItem[];
  catalogActionId?: string;
  codigoUnidadeOrcamentaria?: string;
}

export interface ProcessMap {
  programId: string;
  problemaCentral: string;
  contexto: MapItem[];
  premissas?: MapItem[];
  resultados: MapItem[];
  impactos: MapItem[];
  actions: ProcessAction[];
  status: Status;
  causas?: MapItem[];
}

// ---- OBZ ----
export type Cenario = 'LIMIAR' | 'INCREMENTAL' | 'NÃO INFORMADO';
export interface BudgetSource {
  kind: 'planilha' | 'seed-saude' | 'legado';
  batchId: string; file: string; sheet: string; row: number;
  unitLabel: string; programLabel: string; actionLabel: string; exercise: string | null;
  raw: Record<string, unknown>;
  numbers: Record<string, number | null>;
}
export interface BudgetLinkage {
  status: 'vinculado' | 'pendente' | 'ambiguo' | 'sem-correspondencia' | 'outro-exercicio';
  candidates: string[];
  issues: string[];
}


export interface BudgetItemOBZ {
  id: string;
  codigoUnidadeOrcamentaria?: string;
  programaCodigo?: string;
  exercise?: string | null;
  source?: BudgetSource;
  linkage?: BudgetLinkage;
  totalMode?: 'declarado' | 'calculado' | 'ausente';
  quantities?: { volume: number | null; precoUnitario: number | null; frequenciaPagamento: number | null };
  legacyIdentity?: { programaId: string; actionId: string; unidadeOrcamentaria: string };
  dataIssues?: string[];
  parecerDcmefoOriginal?: unknown;
  deliberacaoCofinOriginal?: unknown;
  unidadeOrcamentaria: string;
  programaId: string;
  actionId: string;
  acaoLabel: string;
  grupo: string;
  elemento: string;
  elementoItem: string;
  agrupamento: string;
  fonte: string;
  descricao: string;
  premissaVolume: string;
  volume: number;
  premissaPreco: string;
  precoUnitario: number;
  frequenciaPagamento: number;
  valorTotal: number;
  classificacaoCenario: Cenario;
  novo: boolean;
  descricaoCenario: string;
  riscoNaoFazer: string;
  beneficioAoFazer: string;
  prioridadeN3: number;
  prioridadeN2: number;
  prioridadeN1: number;
  observacoes: string;
  motivoValidacao?: string;
  cotaAprovada?: boolean;
  validationNeedsReview?: boolean;
  statusValidacao: Status;
}

// ---- Coerência Programa-OBZ ----
export type CoherenceStatus = 'Completo' | 'Parcial' | 'Pendente' | 'Inconsistente';

export interface CoherenceLink {
  id: string;
  budgetItemId: string;
  actionId: string;
  resourceId: string | null;
  activityId: string | null;
  productId: string | null;
  resourceIds?: string[];
  activityIds?: string[];
  productIds?: string[];
  resultId: string | null;
  impactId: string | null;
  status: CoherenceStatus;
  warnings: string[];
  notes: string;
}

// ---- Espelho ----
export interface ProgramMirror {
  codigo: string;
  nome: string;
  unidadeAdministrativa?: string;
  unidadeResponsavel: string;
  orgaoResponsavel?: string;
  areaTematica?: string;
  objetivo: string;
  justificativa: string;
  publicoAlvo: string;
  problema: string;
  horizonteTemporal?: string;
  tipoPrograma?: string;
  diretrizes: string;
  resultados: string;
  impactos: string;
  indicadores: string;
  observacoes: string;
}

export interface ActionMirror {
  codigoPrograma?: string;
  programaNome?: string;
  codigo: string;
  nome: string;
  unidadeAdministrativa?: string;
  unidadeOrcamentaria: string;
  codigoUnidadeOrcamentaria?: string;
  orgao: string;
  codigoOrgao?: string;
  funcao: string;
  subfuncao: string;
  tipoAcao: string;
  iag: string;
  publicoAlvo: string;
  relacaoMulher: string;
  produto: string;
  especificacaoProduto: string;
  unidadeMedida: string;
  finalidade: string;
  descricao: string;
  baseLegal: string;
  regionalizacao: string;
  valorTotalObz: number;
  itensObz: number;
}

export interface IndicatorMirror {
  id: string;
  nome: string;
  programaVinculado: string;
  resultadoVinculado: string;
  descricao: string;
  formula: string;
  unidadeMedida: string;
  polaridade: string;
  periodicidade: string;
  fonteDados: string;
  linhaBase: string;
  meta: string;
  observacoesMetodologicas: string;
  limitacoes: string;
}

export interface Mirror {
  programId: string;
  programMirror: ProgramMirror;
  actionMirrors: ActionMirror[];
  indicatorMirrors: IndicatorMirror[];
}

// ---- Tabelas de apoio ----
export interface SupportList {
  id: string;
  nome: string;
  valores: { id: string; label: string; ativo: boolean }[];
  ultimaAlteracao: string;
  responsavel: string;
}

// ---- Estado global ----
export interface AppState {
  schemaVersion?: number;
  planning?: PlanningProposal;
  perfil: Perfil;
  unidade: string;
  currentProgramId: string;
  programs: Program[];
  actions: Action[];
  frameworks: LogicalFramework[];
  maps: ProcessMap[];
  projectMaps?: ProjectPlanningMap[];
  budgetItems: BudgetItemOBZ[];
  links: CoherenceLink[];
  mirrors: Mirror[];
  support: {
    programmatic: SupportList[];
    budgetary: SupportList[];
  };
  lists: SelectionLists;
}

export interface SelectionLists {
  unidades: string[];
  programas: string[];
  acoes: string[];
  grupos: string[];
  elementos: string[];
  elementosItens: string[];
  agrupamentos: string[];
  fontes: string[];
  funcoes: string[];
  subfuncoes: string[];
  tiposAcao: string[];
  publicos: string[];
  categoriasRecurso: string[];
  categoriasAtividade: string[];
  categoriasProduto: string[];
  periodicidades: string[];
  unidadesMedida: string[];
  polaridades: string[];
}
