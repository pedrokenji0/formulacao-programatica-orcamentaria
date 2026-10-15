import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const normalizeCode = (value) => String(value ?? '').trim().replace(/^0+(?=\d)/, '');
export const programId = (code) => `ppo-programa-${normalizeCode(code)}`;
export const actionId = (program, unit, code) => `ppo-acao-${normalizeCode(program)}-${normalizeCode(unit)}-${normalizeCode(code)}`;
export const flag = (value) => /^(true|sim|1)$/i.test(String(value ?? '').trim()) ? true : /^(false|n[aã]o|0)$/i.test(String(value ?? '').trim()) ? false : null;
const hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 20);
const unique = (values) => [...new Map(values.map((value) => [JSON.stringify(value), value])).values()];
const qualitative = (row) => Object.fromEntries(Object.entries(row).filter(([key]) => !/^Previsão /i.test(key) && !/^Em apuração\? \(20\d\d\)/.test(key) && !key.includes('Previsão(es)')));

export function parsePipe(text) {
  const rows = [];
  let cells = [], cell = '', quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let position = 0; position < source.length; position++) {
    const character = source[position];
    const next = source[position + 1];
    if (character === '"' && !cell && !quoted) quoted = true;
    else if (character === '"' && quoted && next === '"') { cell += '"'; position++; }
    else if (character === '"' && quoted && (next === '|' || next === '\r' || next === '\n' || next == null)) quoted = false;
    else if (character === '|' && !quoted) { cells.push(cell); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') position++;
      cells.push(cell);
      if (cells.some((value) => value !== '')) rows.push(cells);
      cells = []; cell = '';
    } else cell += character;
  }
  if (quoted) throw new Error('Campo entre aspas não foi encerrado.');
  if (cell || cells.length) { cells.push(cell); rows.push(cells); }
  const headers = rows.shift() || [];
  if (!headers.includes('Código do Programa')) throw new Error('Cabeçalho de planejamento não encontrado.');
  return {
    headers,
    rows: rows.map((values, index) => {
      if (values.length !== headers.length) throw new Error(`Registro ${index + 2}: ${values.length} colunas; esperadas ${headers.length}.`);
      return Object.fromEntries(headers.map((header, position) => [header, values[position]]));
    }),
  };
}

export function buildPlanning(input, exercise) {
  if (!/^\d{4}$/.test(exercise || '')) throw new Error('Informe o exercício explicitamente com --exercicio AAAA.');
  const issues = [];
  const report = (kind, id, message) => issues.push({ id: `aviso-${hash(`${kind}|${id}|${message}`)}`, kind, recordId: id, message });
  const groupedPrograms = new Map();
  for (const source of input.programas.rows) {
    const id = programId(source['Código do Programa']);
    const rows = groupedPrograms.get(id) || [];
    rows.push(qualitative(source)); groupedPrograms.set(id, rows);
  }
  const programs = [...groupedPrograms].map(([id, rows]) => {
    const fields = rows[0];
    const linkKeys = ['Código do Objetivo Estratégico', 'Objetivo Estratégico', 'Código da Diretriz Estratégica', 'Diretriz Estratégica', 'Título do Objetivo de Desenvolvimento Sustentável', 'Subtítulo do Objetivo de Desenvolvimento Sustentável'];
    const strategicLinks = unique(rows.map((row) => Object.fromEntries(linkKeys.map((key) => [key, row[key] ?? '']))));
    const baseFields = (row) => Object.fromEntries(Object.entries(row).filter(([key]) => !linkKeys.includes(key)));
    const variants = unique(rows.map(baseFields));
    if (variants.length > 1) report('programa', id, 'Campos cadastrais divergentes nas linhas do programa; todas as variantes foram preservadas.');
    return {
      id, codigo: fields['Código do Programa'], nome: fields['Nome do Programa'],
      unidadeAdministrativa: fields['Unidade Administrativa Responsável pelo Programa'],
      unidadeOrcamentaria: [fields['Código da Unidade Orçamentária Responsável pelo Programa'], fields['Unidade Orçamentária Responsável pelo Programa']].filter(Boolean).join(' - '),
      orgao: fields['Órgão Responsável pelo Programa'], areaTematica: fields['Área Temática'],
      problemaCentral: '', objetivo: fields.Objetivo, justificativa: fields.Justificativa,
      publicoAlvo: '', contexto: '', horizonteTemporal: fields['Horizonte Temporal'], tipoPrograma: fields['Tipo de Programa'],
      resultados: [], impactos: [], status: 'RASCUNHO', officialFields: fields, strategicLinks, sourceVariants: variants,
      causas: fields.Causas, estrategiaImplementacao: fields['Estratégia de Implementação'], codigoOrgao: fields['Código do Órgão Responsável pelo Programa'], codigoUnidadeOrcamentaria: fields['Código da Unidade Orçamentária Responsável pelo Programa'],
      source: { origin: 'PPO', file: 'programas_planejamento.txt' },
    };
  });
  const programIndex = new Map(programs.map((program) => [program.id, program]));
  const groupedActions = new Map();
  for (const source of input.acoes.rows) {
    const id = actionId(source['Código do Programa'], source['Código da Unidade Orçamentária Responsável pela Ação'], source['Código da Ação']);
    const rows = groupedActions.get(id) || [];
    rows.push(qualitative(source)); groupedActions.set(id, rows);
  }
  const actions = [...groupedActions].map(([id, rows]) => {
    const fields = rows[0];
    const parent = programId(fields['Código do Programa']);
    if (!programIndex.has(parent)) report('acao', id, `Programa ${fields['Código do Programa']} não encontrado na base de programas.`);
    if (unique(rows).length > 1) report('acao', id, 'Cadastros divergentes para a mesma combinação programa/UO/ação; variantes preservadas.');
    return {
      id, programaId: parent, codigo: fields['Código da Ação'], nome: fields['Título da Ação'],
      unidadeAdministrativa: fields['Unidade Administrativa Responsável pela Ação'],
      unidadeOrcamentaria: [fields['Código da Unidade Orçamentária Responsável pela Ação'], fields['Unidade Orçamentária Responsável pela Ação']].filter(Boolean).join(' - '),
      codigoUnidadeOrcamentaria: fields['Código da Unidade Orçamentária Responsável pela Ação'],
      orgao: '', funcao: fields.Função, subfuncao: fields.Subfunção,
      tipoAcao: fields['Tipo de Ação'], iag: fields['Identificador de Ação Governamental (IAG)'], publicoAlvo: fields['Público-Alvo'],
      relacaoMulher: fields['Política para mulheres'], produto: fields.Produto, especificacaoProduto: fields['Especificação do Produto'],
      codigoProduto: fields['Código do Produto'], unidadeMedida: fields['Unidade de Medida do Produto'], finalidade: fields['Finalidade da Ação'],
      codigoProjetoEstrategico: fields['Código do Projeto Estratégico'], projetoEstrategico: fields['Projeto Estratégico'],
      descricao: fields['Descrição da Ação'], detalhamentoImplementacao: '', baseLegal: fields['Base legal'],
      status: 'RASCUNHO', officialFields: fields, sourceVariants: unique(rows), source: { origin: 'PPO', file: 'acoes_planejamento.txt' },
      local: { atividades: [], criterioEntrega: '', evidenciaEntrega: '', parceirosCondicoes: '', distribuicaoTerritorial: '', papelLocalizador: '', criteriosTerritoriais: '', condicoesTerritoriais: '' },
    };
  });
  const actionIndex = new Map(actions.map((action) => [action.id, action]));
  const indicators = unique(input.indicadores.rows.map(qualitative)).map((fields) => {
    const parent = programId(fields['Código do Programa']);
    const id = `ppo-indicador-${normalizeCode(fields['Código do Programa'])}-${hash(fields.Indicador)}`;
    if (!programIndex.has(parent)) report('indicador', id, `Programa ${fields['Código do Programa']} não encontrado.`);
    return { id, programId: parent, origin: 'PPO', fields, component: null };
  });
  const indicatorCounts = new Map();
  for (const indicator of indicators) indicatorCounts.set(indicator.id, (indicatorCounts.get(indicator.id) || 0) + 1);
  for (const indicator of indicators) {
    if (indicatorCounts.get(indicator.id) > 1) {
      report('indicador', indicator.id, 'Mesmo nome de indicador com cadastros diferentes; variantes preservadas com identificador distinto.');
      indicator.id += `-${hash(JSON.stringify(indicator.fields))}`;
    }
  }
  const localizerIndex = new Map();
  const territorialKeys = ['Código da Região Geográfica Intermediária', 'Região Geográfica Intermediária', 'Código do Município IBGE', 'Código do Município Sigplan', 'Município'];
  for (const source of input.localizadores.rows) {
    const parent = actionId(source['Código do Programa'], source['Código da Unidade Orçamentária Responsável pela Ação'], source['Código da Ação']);
    const id = `${parent}-localizador-${normalizeCode(source['Código do Localizador'])}`;
    let localizer = localizerIndex.get(id);
    if (!localizer) {
      const fields = qualitative(source);
      territorialKeys.forEach((key) => delete fields[key]);
      localizer = { id, actionId: actionIndex.has(parent) ? parent : null, expectedActionId: parent, programId: programId(source['Código do Programa']), fields, territories: [] };
      localizerIndex.set(id, localizer);
      const action = actionIndex.get(parent);
      if (!action) report('localizador', id, `Vínculo não encontrado: programa ${source['Código do Programa']}, UO ${source['Código da Unidade Orçamentária Responsável pela Ação']}, ação ${source['Código da Ação']}.`);
      else {
        for (const key of ['Título da Ação', 'Exclusão Lógica da Ação', 'Exclusão Lógica do Programa', 'Código do Projeto Estratégico', 'Código da Função', 'Código da Subfunção']) {
          const fromAction = action.officialFields[key];
          const fromLocalizer = source[key];
          const equal = key.includes('Exclusão') ? flag(fromAction) === flag(fromLocalizer) : key.startsWith('Código') ? normalizeCode(fromAction) === normalizeCode(fromLocalizer) : fromAction === fromLocalizer;
          if (!equal) report('localizador', id, `Divergência em ${key}: ações “${fromAction}”; localizadores “${fromLocalizer}”.`);
        }
      }
    }
    const fields = Object.fromEntries(territorialKeys.map((key) => [key, source[key]]));
    const statusFields = Object.fromEntries(['Código do Programa', 'Código da Ação', 'Código da Unidade Orçamentária Responsável pela Ação', 'Código do Localizador', 'Exclusão Lógica do Programa', 'Exclusão Lógica da Ação', 'Exclusão Lógica do Localizador'].map((key) => [key, source[key]]));
    const relation = { id: `${id}-territorio-${hash(JSON.stringify({ fields, statusFields }))}`, fields, statusFields };
    if (!localizer.territories.some((existing) => existing.id === relation.id)) localizer.territories.push(relation);
  }
  const localizers = [...localizerIndex.values()];
  const sources = Object.fromEntries(Object.entries(input).map(([name, source]) => [name, { rows: source.rows.length, headers: source.headers, sha256: source.sha256 || '' }]));
  return {
    manifest: { schemaVersion: 2, exercise, exerciseSource: 'Parâmetro explícito --exercicio; não inferido das colunas de previsão.', encoding: 'windows-1252', delimiter: '|', sources, datasetId: hash(JSON.stringify({ exercise, sources })) },
    programs, actions, indicators, localizers, issues,
  };
}

export function readSources(directory) {
  return Object.fromEntries(Object.entries({ programas: 'programas_planejamento.txt', acoes: 'acoes_planejamento.txt', indicadores: 'indicadores_planejamento.txt', localizadores: 'localizadores_Todos_planejamento.txt' }).map(([name, file]) => {
    const bytes = readFileSync(resolve(directory, file));
    return [name, { ...parsePipe(new TextDecoder('windows-1252').decode(bytes)), sha256: createHash('sha256').update(bytes).digest('hex') }];
  }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const exercise = process.argv[process.argv.indexOf('--exercicio') + 1];
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const data = buildPlanning(readSources(resolve(root, 'data/raw/plan2026')), exercise);
  mkdirSync(resolve(root, 'public/data'), { recursive: true });
  writeFileSync(resolve(root, 'public/data/planning.json.gz'), gzipSync(JSON.stringify(data), { level: 9 }));
  console.log(JSON.stringify({ exercise, programs: data.programs.length, actions: data.actions.length, indicators: data.indicators.length, localizers: data.localizers.length, territories: data.localizers.reduce((total, record) => total + record.territories.length, 0), issues: data.issues, output: 'public/data/planning.json.gz' }, null, 2));
}
