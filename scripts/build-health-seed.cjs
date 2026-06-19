const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const root = path.resolve(__dirname, '..');

const split = (line) => line.replace(/^\uFEFF/, '').split('|');
const onlyDigits = (value) => String(value ?? '').match(/\d+/)?.[0] || '';
const normalizeProgramCode = (value) => {
  const digits = onlyDigits(value);
  if (!digits) return '';
  return String(Number(digits)).padStart(3, '0');
};
const normalizeActionCode = (value) => {
  const digits = onlyDigits(value);
  return digits ? String(Number(digits)) : '';
};
const stripCode = (value) => String(value ?? '').replace(/^\s*[\w.]+\s*-\s*/, '').trim();
const codeLabel = (code, name) => `${code} - ${name}`;

function readPipe(file) {
  const raw = fs.readFileSync(path.join(root, file), 'latin1');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = split(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
}

const planejamento = readPipe('acoes_planejamento.txt');
const healthRows = planejamento.filter((r) =>
  r['Setor de Governo'] === 'SAÚDE'
  || r['Área Temática'] === 'Saúde'
  || r['Código da Unidade Orçamentária Responsável pela Ação'] === '04291'
);

const healthActions = [];
const seenActions = new Set();
for (const r of healthRows) {
  const programaCodigo = normalizeProgramCode(r['Código do Programa']);
  const acaoCodigo = normalizeActionCode(r['Código da Ação']);
  if (!programaCodigo || !acaoCodigo) continue;
  const key = `${programaCodigo}|${acaoCodigo}`;
  if (seenActions.has(key)) continue;
  seenActions.add(key);
  healthActions.push({
    programaCodigo,
    programaNome: r['Nome do Programa'],
    areaTematicaCodigo: r['Código da Área Temática'],
    areaTematica: r['Área Temática'],
    programaNovo: r['Programa Novo'],
    programaJustificativa: r['Justificativa de Inclusão ou Exclusão do Programa'],
    codigoUnidadePrograma: r['Código da Unidade Orçamentária Responsável pelo Programa'],
    unidadePrograma: r['Unidade Orçamentária Responsável pelo Programa'],
    codigoUnidadeAcao: r['Código da Unidade Orçamentária Responsável pela Ação'],
    unidadeAcao: r['Unidade Orçamentária Responsável pela Ação'],
    funcaoCodigo: r['Código da Função'],
    funcao: r['Função'],
    subfuncaoCodigo: r['Código da Subfunção'],
    subfuncao: r['Subfunção'],
    tipoAcaoCodigo: r['Código do Tipo de Ação'],
    tipoAcao: r['Tipo de Ação'],
    acaoCodigo,
    acaoNome: r['Título da Ação'],
    iagCodigo: r['Código do Identificador de Ação Governamental (IAG)'],
    iag: r['Identificador de Ação Governamental (IAG)'],
    unidadeAdministrativa: r['Unidade Administrativa Responsável pela Ação'],
    baseLegal: r['Base legal'],
    finalidade: r['Finalidade da Ação'],
    descricao: r['Descrição da Ação'],
    publicoAlvoCodigo: r['Código do Público-alvo'],
    publicoAlvo: r['Público-Alvo'],
    produtoCodigo: r['Código do Produto'],
    produto: r['Produto'],
    especificacaoProduto: r['Especificação do Produto'],
    unidadeMedidaCodigo: r['Código da Unidade de Medida do Produto'],
    unidadeMedida: r['Unidade de Medida do Produto'],
    previsaoOrcamentaria2027: Number(r['Previsão Orçamentária 2027'] || 0),
    previsaoFisica2027: Number(r['Previsão Física 2027'] || 0),
    setorGoverno: r['Setor de Governo'],
    politicaMulheres: r['Política para mulheres'],
  });
}

const wb = XLSX.readFile(path.join(root, '4291.xlsx'), { cellDates: false });
const obzRows = XLSX.utils.sheet_to_json(wb.Sheets['BASE OBZ'], { header: 1, blankrows: false, defval: '' });
const obzHeader = obzRows[1];
const idx = Object.fromEntries(obzHeader.map((h, i) => [String(h).trim(), i]));
const get = (row, name) => row[idx[name]] ?? '';
const number = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const obzItems = obzRows.slice(2).filter((row) => get(row, 'PROGRAMA') && get(row, 'AÇÃO')).map((row) => {
  const programaCodigo = normalizeProgramCode(get(row, 'PROGRAMA'));
  const acaoCodigo = normalizeActionCode(get(row, 'AÇÃO'));
  return {
    org: 'FES/SES',
    uo: String(get(row, 'UNIDADE ORÇAMENTÁRIA')).trim() || 'FES',
    n2: get(row, 'N2'),
    n3: get(row, 'N3'),
    programa: codeLabel(programaCodigo, stripCode(get(row, 'PROGRAMA'))),
    acao: codeLabel(acaoCodigo, stripCode(get(row, 'AÇÃO'))),
    grupo: get(row, 'GRUPO'),
    elemento: get(row, 'ELEMENTO_ITEM'),
    agrupamento: get(row, 'Agrupamento'),
    fonte: String(get(row, 'FONTE')).trim(),
    descricao: get(row, 'DESCRIÇÃO DO ITEM'),
    novo: String(get(row, 'NOVO?')).trim().toUpperCase() === 'SIM',
    premissaVolume: get(row, 'PREMISSA VOLUME'),
    volume: number(get(row, 'VOLUME')),
    premissaPreco: get(row, 'PREMISSA DE PREÇO'),
    precoUnitario: number(get(row, 'PREÇO UNITÁRIO')),
    frequencia: number(get(row, 'FREQUÊNCIA PAGAMENTO')),
    valorTotal: number(get(row, 'VALOR TOTAL ITEM')),
    classificacao: String(get(row, 'CLASSIFICAÇÃO CENÁRIO')).trim().toUpperCase() === 'LIMIAR' ? 'LIMIAR' : 'INCREMENTAL',
    descricaoCenario: get(row, 'DESCRIÇÃO DO CENÁRIO'),
    risco: get(row, 'RISCO DE NÃO FAZER'),
    beneficio: get(row, 'BENEFICIO AO FAZER'),
    pN3: number(get(row, 'PRIORIDADE N3')),
    pN2: number(get(row, 'PRIORIDADE N2')),
    pN1: number(get(row, 'PRIORIDADE N1')),
    parecerDcmefo: get(row, 'PARECER DCMEFO'),
    deliberacaoCofin: get(row, 'DELIBERAÇÃO COFIN'),
  };
});

const acaoDetails = {};
for (const item of healthActions) {
  acaoDetails[item.acaoCodigo] = {
    finalidade: item.finalidade,
    descricao: item.descricao,
    publicoAlvo: item.publicoAlvo,
    produto: item.produto,
    especificacao: item.especificacaoProduto,
    funcao: item.funcao,
    subfuncao: item.subfuncao,
    tipoAcao: item.tipoAcao,
    iag: item.iag,
    baseLegal: item.baseLegal,
    unidadeMedida: item.unidadeMedida,
    unidadeAdministrativa: item.unidadeAdministrativa,
    codigoProduto: item.produtoCodigo,
    codigoUnidadeOrcamentaria: item.codigoUnidadeAcao,
    codigoOrgao: item.codigoUnidadePrograma,
    relacaoMulher: item.politicaMulheres,
  };
}

const uniq = (values) => Array.from(new Set(values.filter((v) => v != null && String(v).trim() !== '').map((v) => String(v).trim())));
const programsByCode = new Map();
for (const a of healthActions) programsByCode.set(a.programaCodigo, a.programaNome);
for (const obz of obzItems) {
  const code = normalizeProgramCode(obz.programa);
  if (!programsByCode.has(code)) programsByCode.set(code, stripCode(obz.programa));
}
const actionsByCode = new Map();
for (const a of healthActions) actionsByCode.set(`${a.programaCodigo}|${a.acaoCodigo}`, a.acaoNome);
for (const obz of obzItems) {
  const pCode = normalizeProgramCode(obz.programa);
  const aCode = normalizeActionCode(obz.acao);
  if (!actionsByCode.has(`${pCode}|${aCode}`)) actionsByCode.set(`${pCode}|${aCode}`, stripCode(obz.acao));
}

const seed = {
  healthActions,
  obzItems,
  acaoDetails,
  lists: {
    unidades: uniq([...healthActions.map((a) => `${a.codigoUnidadeAcao} - ${a.unidadeAcao}`), '4291 - Fundo Estadual de Saúde (SES)']),
    programas: Array.from(programsByCode).map(([code, name]) => codeLabel(code, name)),
    acoes: Array.from(actionsByCode).map(([key, name]) => codeLabel(key.split('|')[1], name)),
    grupos: uniq(obzItems.map((i) => i.grupo)),
    elementos: ['ELEMENTO'],
    elementosItens: uniq(obzItems.map((i) => i.elemento)),
    agrupamentos: uniq(obzItems.map((i) => i.agrupamento)),
    fontes: uniq(obzItems.map((i) => i.fonte)),
    funcoes: uniq(healthActions.map((a) => a.funcao)),
    subfuncoes: uniq(healthActions.map((a) => a.subfuncao)),
    tiposAcao: uniq(healthActions.map((a) => a.tipoAcao)),
    publicos: uniq(healthActions.map((a) => a.publicoAlvo)),
    produtos: uniq(healthActions.map((a) => a.produto)),
    unidadesMedida: uniq(healthActions.map((a) => a.unidadeMedida)),
  },
};

fs.writeFileSync(path.join(root, 'scripts/seed.health.json'), `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  healthActions: healthActions.length,
  programs: seed.lists.programas.length,
  actions: seed.lists.acoes.length,
  obzItems: obzItems.length,
  output: 'scripts/seed.health.json',
}, null, 2));
