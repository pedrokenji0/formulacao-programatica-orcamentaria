import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePipe, normalizeCode, flag } from './planning-import.mjs';

export function planningCycleYears(revisionYear) {
  if (!/^\d{4}$/.test(String(revisionYear))) throw new Error('Informe o ano de revisão da base.');
  return Array.from({ length:4 }, (_, index) => String(Number(revisionYear) + index));
}
export function buildPlanningTerritoryCatalog(localizers, actions, source, cycle, municipalityCodes) {
  const years = planningCycleYears(cycle.revisionYear);
  const valid = new Set(municipalityCodes);
  const active = row => !['Exclusão Lógica do Programa','Exclusão Lógica da Ação','Exclusão Lógica do Localizador'].some(key => flag(row[key]) === true);
  const number = value => { if (value === undefined || String(value).trim() === '') return null; const result = Number(String(value).replace(',', '.')); if (!Number.isFinite(result) || result < 0) throw new Error('Previsão inválida.'); return result; };
  const selectedProjects = new Set(['14','56','64','20']);
  const key = row => [normalizeCode(row['Código do Programa']), normalizeCode(row['Código da Unidade Orçamentária Responsável pela Ação']), normalizeCode(row['Código da Ação'])].join('/');
  const selected = actions.filter(row => active(row) && normalizeCode(row['Código do Identificador de Ação Governamental (IAG)']) === '1' && selectedProjects.has(normalizeCode(row['Código do Projeto Estratégico'])));
  const records = new Map();
  for (const row of selected) {
    const id = key(row), projectCode = normalizeCode(row['Código do Projeto Estratégico']);
    if (records.has(id)) { if (records.get(id).projectCode !== projectCode) throw new Error('Vínculo estratégico ambíguo: ' + id); continue; }
    records.set(id, { id:'ppo-acao-' + id.replaceAll('/', '-'), code:normalizeCode(row['Código da Ação']), name:row['Título da Ação'], programCode:normalizeCode(row['Código do Programa']), programName:row['Nome do Programa'], projectCode, projectName:row['Projeto Estratégico'], ownerUnit:normalizeCode(row['Código da Unidade Orçamentária Responsável pela Ação']), ownerUnitName:row['Unidade Orçamentária Responsável pela Ação'], productCode:row['Código do Produto'], product:row.Produto, unitCode:row['Código da Unidade de Medida do Produto'], unit:row['Unidade de Medida do Produto'], totals:Object.fromEntries(years.map(year => [year,{physical:number(row['Previsão Física ' + year]),budget:number(row['Previsão Orçamentária ' + year])}])), localizers:[] });
  }
  localizers.forEach((row, index) => {
    const action = records.get(key(row));
    if (!action || !active(row) || normalizeCode(row['Código do Projeto Estratégico']) !== action.projectCode) return;
    const municipality = String(row['Código do Município IBGE'] || '').trim(), region = normalizeCode(row['Código da Região Geográfica Intermediária']);
    const scope = municipality === '3199999' || region === '99' ? 'state' : valid.has(municipality) ? 'municipality' : /^31999\d{2}$/.test(municipality) && Number(region) >= 1 && Number(region) <= 13 ? 'intermediate' : null;
    if (!scope) throw new Error('Território desconhecido no localizador ' + row['Código do Localizador']);
    const code = row['Código do Localizador'];
    if (action.localizers.some(record => record.code === code)) throw new Error('Localizador duplicado: ' + code);
    action.localizers.push({ code, scope, territoryCode:scope === 'state' ? '31' : scope === 'intermediate' ? '31' + region.padStart(2,'0') : municipality, territoryName:row.Município || row['Região Geográfica Intermediária'], sourceRow:index + 2, forecasts:Object.fromEntries(years.map(year => [year,{physical:number(row['Previsão Física ' + year]),budget:number(row['Previsão Orçamentária ' + year])}])) });
  });
  const projects = [...selectedProjects].map(code => {
    const projectActions = [...records.values()].filter(action => action.projectCode === code);
    return { code, name:projectActions[0]?.projectName || '', actions:projectActions };
  }).filter(project => project.actions.length);
  return { schemaVersion:1, cycle:{ revisionYear:String(cycle.revisionYear), preparedIn:String(cycle.preparedIn || ''), years }, source, projects };
}
export function readPlanningTerritoryCatalog({ revisionYear='2026', preparedIn='2025', sourceDirectory='data/raw/plan2026' } = {}) {
  const read = filename => { const path = sourceDirectory + '/' + filename, bytes = readFileSync(path); return { rows:parsePipe(new TextDecoder('windows-1252').decode(bytes)).rows, source:{path,blobSha:createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'),bytes])).digest('hex')} }; };
  const localizers = read('localizadores_Todos_planejamento.txt'), actions = read('acoes_planejamento.txt');
  const municipalities = JSON.parse(readFileSync('public/data/mg-municipios.json','utf8')).municipalities.map(row => row.code);
  return buildPlanningTerritoryCatalog(localizers.rows, actions.rows, {localizers:localizers.source,actions:actions.source}, {revisionYear,preparedIn}, municipalities);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
  const catalog = readPlanningTerritoryCatalog({revisionYear:arg('--revision-year'),preparedIn:arg('--prepared-in'),sourceDirectory:arg('--source-directory')});
  writeFileSync('data/territorio/planejamento-projetos.json',JSON.stringify(catalog) + '\n');
  console.log(JSON.stringify({cycle:catalog.cycle,projects:catalog.projects.map(project => ({code:project.code,name:project.name,actions:project.actions.map(action => ({code:action.code,uo:action.ownerUnit,localizers:action.localizers.length,totals:action.totals}))}))},null,2));
}
