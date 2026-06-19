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
// Programa-vitrine: 105 — Formação e Capacitação Técnico-Cultural (FAOP)
// ---------------------------------------------------------------------------
const PROG_105: Program = {
  id: 'prog-105',
  codigo: '105',
  nome: 'Formação e Capacitação Técnico-Cultural',
  unidadeOrcamentaria: '1481 — Fundação de Arte de Ouro Preto',
  orgao: 'FAOP',
  problemaCentral: 'Baixo acesso de públicos prioritários à formação técnico-cultural continuada em Minas Gerais.',
  objetivo: 'Ampliar o acesso de públicos prioritários à formação técnico-cultural continuada.',
  justificativa: 'Desigualdade territorial de acesso e dificuldade de permanência em atividades presenciais reduzem a qualificação de agentes culturais no interior.',
  publicoAlvo: 'Trabalhadores, estudantes e agentes culturais com menor acesso a oportunidades formativas.',
  contexto: 'Forte vocação cultural e patrimonial das cidades históricas, com baixa oferta regionalizada de formação.',
  resultados: ['Ampliação do acesso à formação técnico-cultural', 'Melhoria da qualificação profissional de agentes culturais'],
  impactos: ['Fortalecimento da formação cultural', 'Redução de desigualdades territoriais de acesso à cultura'],
  status: 'EM PREENCHIMENTO',
};

const ACT_1029: Action = {
  id: 'act-1029',
  codigo: '1029',
  nome: 'Atividades de Ensino, Formação e Qualificação Profissional e Técnica em Cultura e Patrimônio',
  programaId: 'prog-105',
  unidadeOrcamentaria: '1481 — Fundação de Arte de Ouro Preto',
  orgao: 'FAOP',
  funcao: 'CULTURA',
  subfuncao: 'DIFUSÃO CULTURAL',
  tipoAcao: 'Atividade Fim do Orçamento Fiscal',
  iag: 'Demais Projetos e Atividades',
  publicoAlvo: 'Agentes culturais, estudantes e trabalhadores da cultura.',
  produto: 'PESSOA CAPACITADA',
  especificacaoProduto: 'Participantes concluintes de oficinas e cursos de formação técnico-cultural.',
  unidadeMedida: 'UNIDADE',
  finalidade: 'Promover a formação e a qualificação técnica de agentes culturais em cultura e patrimônio.',
  descricao: 'Realização de oficinas e cursos presenciais e a distância, com contratação de formadores e apoio logístico à execução.',
  baseLegal: 'Lei Estadual de incentivo à cultura; estatuto da FAOP.',
  status: 'EM PREENCHIMENTO',
};

const obz = (p: Partial<BudgetItemOBZ>): BudgetItemOBZ => ({
  id: p.id!, unidadeOrcamentaria: '1481 — Fundação de Arte de Ouro Preto', programaId: 'prog-105',
  actionId: 'act-1029', acaoLabel: '1029 — Atividades de Ensino, Formação e Qualificação',
  grupo: '3 — Outras Despesas de Custeio', elemento: 'ELEMENTO', elementoItem: '', agrupamento: '',
  fonte: '10', descricao: '', premissaVolume: '', volume: 0, premissaPreco: '', precoUnitario: 0,
  frequenciaPagamento: 1, valorTotal: 0, classificacaoCenario: 'LIMIAR', novo: false,
  descricaoCenario: '', riscoNaoFazer: '', beneficioAoFazer: '', prioridadeN3: 0, prioridadeN2: 0,
  prioridadeN1: 0, observacoes: '', statusValidacao: 'EM PREENCHIMENTO', ...p,
});

const OBZ_105: BudgetItemOBZ[] = [
  obz({ id: 'obz-3903', elementoItem: '3903 — Fornecimento de alimentação', agrupamento: 'Alimentação',
    descricao: 'Fornecimento de alimentação aos participantes das oficinas presenciais.', premissaVolume: '1 contrato × 12 meses', volume: 1,
    premissaPreco: 'Valor histórico de contrato', precoUnitario: 1500, frequenciaPagamento: 12, valorTotal: 18000,
    classificacaoCenario: 'LIMIAR', riscoNaoFazer: 'Reduz adesão e continuidade das atividades presenciais.',
    beneficioAoFazer: 'Viabiliza a permanência dos participantes nas oficinas presenciais.', prioridadeN3: 0, prioridadeN2: 0, prioridadeN1: 0 }),
  obz({ id: 'obz-1401', elementoItem: '1401 — Diárias civil', agrupamento: 'Diárias e viagens',
    descricao: 'Diárias para deslocamento de formadores às oficinas regionalizadas.', premissaVolume: '40 diárias no ano', volume: 40,
    premissaPreco: 'Decreto 47.045/2016', precoUnitario: 310, frequenciaPagamento: 1, valorTotal: 12400,
    classificacaoCenario: 'LIMIAR', riscoNaoFazer: 'Inviabiliza a presença de formadores no interior.',
    beneficioAoFazer: 'Permite a oferta presencial regionalizada da formação.', prioridadeN3: 0, prioridadeN2: 0, prioridadeN1: 0 }),
  obz({ id: 'obz-3301', elementoItem: '3301 — Passagens', agrupamento: 'Diárias e viagens',
    descricao: 'Passagens para deslocamento de formadores e equipe técnica.', premissaVolume: '24 trechos', volume: 24,
    premissaPreco: 'Valor médio de mercado', precoUnitario: 400, frequenciaPagamento: 1, valorTotal: 9600,
    classificacaoCenario: 'INCREMENTAL', novo: false, descricaoCenario: 'Ampliação da cobertura territorial das oficinas.',
    beneficioAoFazer: 'Amplia o alcance da formação a mais municípios.', prioridadeN3: 1, prioridadeN2: 1, prioridadeN1: 1 }),
  obz({ id: 'obz-3005', elementoItem: '3005 — Material para escritório', agrupamento: 'Material de consumo',
    descricao: 'Material didático e de escritório para as oficinas.', premissaVolume: '1 kit mensal', volume: 1,
    premissaPreco: 'SIAD', precoUnitario: 350, frequenciaPagamento: 12, valorTotal: 4200,
    classificacaoCenario: 'LIMIAR', riscoNaoFazer: 'Compromete a realização das atividades didáticas.',
    beneficioAoFazer: 'Garante insumos mínimos para a execução das oficinas.', prioridadeN3: 0, prioridadeN2: 0, prioridadeN1: 0 }),
  obz({ id: 'obz-3390', elementoItem: '3390 — Serviços de terceiros', agrupamento: 'Serviços de apoio',
    descricao: 'Serviços de terceiros para apoio à produção das oficinas itinerantes.', premissaVolume: '1 contrato anual', volume: 1,
    premissaPreco: 'Cotação de mercado', precoUnitario: 22000, frequenciaPagamento: 1, valorTotal: 22000,
    classificacaoCenario: 'INCREMENTAL', novo: true, descricaoCenario: 'Formação itinerante com apoio especializado.',
    beneficioAoFazer: 'Viabiliza oficinas itinerantes e parcerias municipais.', prioridadeN3: 2, prioridadeN2: 2, prioridadeN1: 2 }),
];

const FW_105: LogicalFramework = {
  programId: 'prog-105',
  problemTheory: {
    territorio: 'Minas Gerais — com foco em municípios do interior e cidades históricas.',
    publicoAfetado: 'Trabalhadores, estudantes e agentes culturais com menor acesso a oportunidades formativas.',
    problemaCentral: PROG_105.problemaCentral,
    situacaoAtual: 'Oferta de formação técnico-cultural concentrada na capital e em poucos polos, com baixa permanência do público do interior.',
    evidencias: 'Baixa oferta regionalizada, desigualdade territorial de acesso e dificuldade de permanência em atividades presenciais.',
    fonteEvidencias: 'Registros administrativos da FAOP; relatórios de execução das oficinas.',
    justificativa: 'A baixa qualificação de agentes culturais limita a produção cultural local e a preservação do patrimônio.',
    hipotesesCausais: 'Custos de deslocamento/alimentação, baixa capilaridade institucional e calendário formativo fragmentado.',
    limitacoesExternas: 'Restrições fiscais e disponibilidade de formadores especializados.',
    situacaoFutura: 'Formação técnico-cultural continuada acessível a públicos prioritários em todo o estado.',
    observacoes: '',
  },
  involvedActors: [
    { id: 'ia1', nome: 'Agentes culturais do interior', papel: 'Beneficiário', interesse: 'Acesso à formação continuada', influencia: 'média', posicao: 'apoia' },
    { id: 'ia2', nome: 'Secretarias municipais de cultura', papel: 'Parceiro', interesse: 'Capacitação local', influencia: 'média', posicao: 'apoia' },
    { id: 'ia3', nome: 'Órgão central de orçamento', papel: 'Regulador', interesse: 'Eficiência do gasto', influencia: 'alta', posicao: 'neutro' },
  ],
  problemNodes: [
    { id: 'pn-central', text: 'Baixo acesso de públicos prioritários à formação técnico-cultural continuada.', type: 'problema central', parentId: null, evidence: 'Relatórios de execução', isModifiable: 'parcial', isParameter: false, notes: '' },
    { id: 'pn-ce1', text: 'Desigualdade territorial na oferta de formação.', type: 'causa estrutural', parentId: 'pn-central', evidence: 'Distribuição das oficinas', isModifiable: 'parcial', isParameter: false, notes: '' },
    { id: 'pn-ce2', text: 'Baixa capacidade instalada em municípios menores.', type: 'causa estrutural', parentId: 'pn-central', evidence: '', isModifiable: 'parcial', isParameter: false, notes: '' },
    { id: 'pn-cm1', text: 'Insuficiência de articulação regional.', type: 'causa maior', parentId: 'pn-central', evidence: '', isModifiable: 'sim', isParameter: false, notes: '' },
    { id: 'pn-cm2', text: 'Baixa disponibilidade de formadores especializados.', type: 'causa maior', parentId: 'pn-central', evidence: '', isModifiable: 'parcial', isParameter: false, notes: '' },
    { id: 'pn-cm3', text: 'Dificuldade de financiamento de atividades presenciais.', type: 'causa maior', parentId: 'pn-central', evidence: '', isModifiable: 'sim', isParameter: false, notes: '' },
    { id: 'pn-cs1', text: 'Custos de alimentação e deslocamento.', type: 'causa superficial', parentId: 'pn-central', evidence: '', isModifiable: 'sim', isParameter: false, notes: '' },
    { id: 'pn-cs2', text: 'Calendário formativo pouco integrado.', type: 'causa superficial', parentId: 'pn-central', evidence: '', isModifiable: 'sim', isParameter: false, notes: '' },
    { id: 'pn-cs3', text: 'Divulgação insuficiente das oportunidades.', type: 'causa superficial', parentId: 'pn-central', evidence: '', isModifiable: 'sim', isParameter: false, notes: '' },
    { id: 'pn-cd1', text: 'Baixa participação de públicos do interior.', type: 'consequência direta', parentId: 'pn-central', evidence: '', isModifiable: 'sim', isParameter: false, notes: '' },
    { id: 'pn-cd2', text: 'Descontinuidade na trajetória formativa.', type: 'consequência direta', parentId: 'pn-central', evidence: '', isModifiable: 'sim', isParameter: false, notes: '' },
    { id: 'pn-cf1', text: 'Manutenção de desigualdades culturais territoriais.', type: 'consequência final', parentId: 'pn-central', evidence: '', isModifiable: 'não', isParameter: false, notes: '' },
    { id: 'pn-cf2', text: 'Menor inclusão social por meio da cultura.', type: 'consequência final', parentId: 'pn-central', evidence: '', isModifiable: 'não', isParameter: false, notes: '' },
  ],
  objectiveNodes: [],
  alternatives: [
    { id: 'alt1', meio: 'Fortalecer oferta regionalizada', acaoPossivel: 'Formação presencial regionalizada', produtoPossivel: 'Oficinas regionais ofertadas', atividadeAssociada: 'Realizar oficinas presenciais', custo: 'médio', tempoImplementacao: 'Curto', capacidadeOperacional: 'Alta', impactoPotencial: 'Alto', viabilidade: 'Alta', aderenciaPpag: 'Alta', observacoes: '', scores: { c1: 4, c2: 5, c3: 4, c4: 4 } },
    { id: 'alt2', meio: 'Ampliar articulação com municípios', acaoPossivel: 'Formação híbrida com apoio remoto', produtoPossivel: 'Cursos híbridos ofertados', atividadeAssociada: 'Disponibilizar EAD', custo: 'baixo', tempoImplementacao: 'Médio', capacidadeOperacional: 'Média', impactoPotencial: 'Médio', viabilidade: 'Média', aderenciaPpag: 'Média', observacoes: '', scores: { c1: 5, c2: 3, c3: 5, c4: 3 } },
    { id: 'alt3', meio: 'Viabilizar participação presencial', acaoPossivel: 'Formação itinerante com parcerias municipais', produtoPossivel: 'Oficinas itinerantes', atividadeAssociada: 'Itinerância com parceiros', custo: 'alto', tempoImplementacao: 'Médio', capacidadeOperacional: 'Média', impactoPotencial: 'Alto', viabilidade: 'Média', aderenciaPpag: 'Alta', observacoes: '', scores: { c1: 3, c2: 4, c3: 3, c4: 5 } },
  ],
  criteria: [
    { id: 'c1', nome: 'Custo', peso: 2 }, { id: 'c2', nome: 'Impacto potencial', peso: 3 },
    { id: 'c3', nome: 'Viabilidade operacional', peso: 2 }, { id: 'c4', nome: 'Aderência ao PPAG', peso: 1 },
  ],
  selectedAlternativeId: 'alt1',
  synthesis: '',
  status: 'EM PREENCHIMENTO',
};

const MAP_105: ProcessMap = {
  programId: 'prog-105',
  problemaCentral: PROG_105.problemaCentral,
  contexto: [
    { id: 'm-ctx1', texto: 'Demanda contínua por capacitação de profissionais de cultura e patrimônio.', categoria: 'Demanda social' },
    { id: 'm-ctx2', texto: 'Forte vocação cultural e patrimonial das cidades históricas.', categoria: 'Potencial regional' },
  ],
  premissas: [
    { id: 'm-pre1', texto: 'Municípios parceiros mantêm agenda e espaço físico para as oficinas.', categoria: 'Operacional' },
  ],
  resultados: [
    { id: 'm-res1', texto: 'Ampliação do acesso à formação técnico-cultural.', categoria: 'Acesso a serviços' },
    { id: 'm-res2', texto: 'Melhoria da qualificação profissional de agentes culturais.', categoria: 'Mudança de comportamento' },
  ],
  impactos: [
    { id: 'm-imp1', texto: 'Fortalecimento da formação cultural.', categoria: 'Desenvolvimento cultural' },
    { id: 'm-imp2', texto: 'Redução de desigualdades territoriais de acesso à cultura.', categoria: 'Redução de desigualdades' },
  ],
  actions: [
    {
      id: 'pa-1029', codigo: '1029', nome: 'Atividades de Ensino, Formação e Qualificação',
      objetivo: 'Qualificar agentes culturais em cultura e patrimônio.',
      publicoAlvo: 'Agentes culturais, estudantes e trabalhadores da cultura.',
      recursos: [
        { id: 'r1', texto: 'Professores/oficineiros especializados.', categoria: 'Pessoas' },
        { id: 'r2', texto: 'Material didático e pedagógico.', categoria: 'Materiais/insumos recorrentes' },
        { id: 'r3', texto: 'Apoio logístico à execução presencial.', categoria: 'Logística' },
        { id: 'r4', texto: 'Sistemas de inscrição e acompanhamento.', categoria: 'Equipamentos e tecnologia' },
      ],
      atividades: [
        { id: 'a1', texto: 'Planejar calendário de cursos.', categoria: 'Planejamento e gestão', preProduto: 'Calendário formativo aprovado' },
        { id: 'a2', texto: 'Contratar professores/oficineiros.', categoria: 'Contratações', preProduto: 'Instrutores contratados' },
        { id: 'a3', texto: 'Realizar oficinas presenciais.', categoria: 'Formação de externos', preProduto: 'Turmas executadas' },
        { id: 'a4', texto: 'Monitorar frequência e avaliação.', categoria: 'Monitoramento', preProduto: 'Relatório de frequência' },
      ],
      produtos: [
        { id: 'p1', texto: 'Oficinas e cursos ofertados.', publicos: ['Agentes culturais', 'Estudantes'] },
        { id: 'p2', texto: 'Participantes capacitados.', publicos: ['Trabalhadores da cultura'] },
        { id: 'p3', texto: 'Materiais pedagógicos produzidos.', publicos: ['Agentes culturais'] },
      ],
      pressupostos: [{ id: 'ps1', texto: 'Adesão dos municípios parceiros.' }],
      riscos: [{ id: 'rk1', texto: 'Restrição orçamentária reduz oferta presencial.' }],
    },
  ],
  status: 'EM PREENCHIMENTO',
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
  const aKey = `${pCode}|${aCode}`;
  let actionId = actIndex.get(aKey);
  if (!actionId) {
    actionId = `act-saude-${pCode}-${aCode}`;
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

for (const it of seed.obzItems as any[]) {
  const uo = it.org === 'FES/SES' ? '4291 - Fundo Estadual de Saúde (SES)' : (uoLabel[it.org] || it.org);
  const pCode = programCodeOf(it.programa);
  const programId = upsertProgram(pCode, it.programa.replace(/^[\w.]+\s*-\s*/, ''), {
    unidadeOrcamentaria: uo,
    orgao: it.org,
    areaTematica: 'Saúde',
  });
  const aCode = actionCodeOf(it.acao);
  const det = (seed.acaoDetails as any)[aCode] || {};
  const actionId = upsertAction(programId, pCode, aCode, it.acao.replace(/^[\w.]+\s*-\s*/, ''), {
    unidadeOrcamentaria: uo,
    codigoUnidadeOrcamentaria: '04291',
    orgao: it.org,
    ...det,
  });
  budgetItems.push({
    id: `obz-${slug(it.org)}-${aCode}-${budgetItems.length}`,
    unidadeOrcamentaria: uo, programaId: programId, actionId, acaoLabel: it.acao,
    grupo: it.grupo, elemento: 'ELEMENTO', elementoItem: it.elemento, agrupamento: it.agrupamento, fonte: String(it.fonte),
    descricao: it.descricao, premissaVolume: it.premissaVolume, volume: it.volume, premissaPreco: it.premissaPreco,
    precoUnitario: it.precoUnitario, frequenciaPagamento: it.frequencia, valorTotal: it.valorTotal,
    classificacaoCenario: it.classificacao, novo: !!it.novo, descricaoCenario: it.descricaoCenario,
    riscoNaoFazer: it.risco, beneficioAoFazer: it.beneficio, prioridadeN3: it.pN3, prioridadeN2: it.pN2,
    prioridadeN1: it.pN1, observacoes: `N2: ${it.n2 || '-'} | N3: ${it.n3 || '-'}`,
    cotaAprovada: it.deliberacaoCofin != null ? Number(it.deliberacaoCofin) > 0 : undefined,
    statusValidacao: 'EM PREENCHIMENTO',
  });
}

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
    '1481 — Fundação de Arte de Ouro Preto', '1261 — Secretaria de Estado de Educação (SEE)',
    '1451 — Sec. de Justiça e Segurança Pública (SEJUSP)', '1501 — Secretaria de Planejamento e Gestão (SEPLAG)',
    '4291 — Fundo Estadual de Saúde (SES)', '1501001 — Central Geral',
  ]),
  programas: uniq([`105 — ${PROG_105.nome}`, ...((seed.lists.programas as string[]) || [])]),
  acoes: uniq([`1029 — ${ACT_1029.nome}`, ...((seed.lists.acoes as string[]) || [])]),
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
// Espelho inicial do programa-vitrine
// ---------------------------------------------------------------------------
const mirrors: Mirror[] = [{
  programId: 'prog-105',
  programMirror: {
    codigo: '105', nome: PROG_105.nome, unidadeResponsavel: PROG_105.unidadeOrcamentaria,
    objetivo: PROG_105.objetivo, justificativa: PROG_105.justificativa, publicoAlvo: PROG_105.publicoAlvo,
    problema: PROG_105.problemaCentral, diretrizes: 'Acesso à cultura; redução de desigualdades territoriais.',
    resultados: PROG_105.resultados.join('; '), impactos: PROG_105.impactos.join('; '),
    indicadores: 'Número de participantes capacitados em atividades de formação técnico-cultural.', observacoes: '',
  },
  actionMirrors: [],
  indicatorMirrors: [{
    id: 'ind1', nome: 'Participantes capacitados em formação técnico-cultural', programaVinculado: '105',
    resultadoVinculado: 'Ampliação do acesso à formação técnico-cultural', descricao: 'Mede o alcance da formação.',
    formula: 'Soma de participantes concluintes no período', unidadeMedida: 'PESSOA', polaridade: 'Quanto maior, melhor',
    periodicidade: 'Anual', fonteDados: 'Registros administrativos da ação', linhaBase: '320 (2025)', meta: '500 (2027)',
    observacoesMetodologicas: 'Considera apenas concluintes.', limitacoes: 'Não capta evasão parcial.',
  }],
}];

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------
export const initialState: AppState = {
  perfil: 'Técnico do Órgão',
  unidade: '4291 - Fundo Estadual de Saúde (SES)',
  currentProgramId: defaultProgramId,
  programs, actions, frameworks: [], maps, budgetItems, links: [], mirrors: [], support, lists,
};
