import { readFileSync } from 'node:fs';
import { parsePipe, normalizeCode, flag } from './planning-import.mjs';

const read = path => parsePipe(new TextDecoder('windows-1252').decode(readFileSync(path))).rows;
const raw = read('data/raw/plan2026/localizadores_Todos_planejamento.txt');
const actions = read('data/raw/plan2026/acoes_planejamento.txt');
const valid = new Set(JSON.parse(readFileSync('public/data/mg-municipios.json', 'utf8')).municipalities.map(m => m.code));
const num = value => String(value ?? '').trim() === '' ? null : Number(String(value).replace(',', '.'));
const active = row => !['Exclusão Lógica do Programa','Exclusão Lógica da Ação','Exclusão Lógica do Localizador'].some(key => flag(row[key]) === true);
const sum = values => { const present = values.filter(value => value !== null && Number.isFinite(value)); return present.length ? present.reduce((total, value) => total + value, 0) : null; };
const years = [...new Set(Object.keys(raw[0]).map(key => /^Previsão Física (\d{4})$/.exec(key)?.[1]).filter(Boolean))];
const keyOf = row => [normalizeCode(row['Código do Programa']), normalizeCode(row['Código da Unidade Orçamentária Responsável pela Ação']), normalizeCode(row['Código da Ação'])].join('/');
const meta = new Map(actions.filter(active).map(row => [keyOf(row), row]));
const groups = new Map();
raw.forEach((row, index) => {
  if (!active(row) || normalizeCode(row['Código do Identificador de Ação Governamental (IAG)']) !== '1' || !normalizeCode(row['Código do Projeto Estratégico'])) return;
  const key = normalizeCode(row['Código do Projeto Estratégico']) + '/' + keyOf(row);
  if (!groups.has(key)) groups.set(key, { projectCode:normalizeCode(row['Código do Projeto Estratégico']), project:row['Projeto Estratégico'], program:normalizeCode(row['Código do Programa']), programName:row['Nome do Programa'], action:normalizeCode(row['Código da Ação']), actionName:row['Título da Ação'], unit:normalizeCode(row['Código da Unidade Orçamentária Responsável pela Ação']), unitName:row['Unidade Orçamentária Responsável pela Ação'], rows:[] });
  groups.get(key).rows.push({ ...row, sourceRow:index + 2 });
});
const candidates = [];
for (const group of groups.values()) for (const year of years) {
  const budgetField = 'Previsão Orçamentária ' + year, physicalField = 'Previsão Física ' + year;
  const qualified = group.rows.filter(row => valid.has(row['Código do Município IBGE']) && num(row[budgetField]) > 0 && num(row[physicalField]) > 0);
  const municipalities = [...new Set(qualified.map(row => row['Código do Município IBGE']))];
  if (municipalities.length < 2) continue;
  const actionMeta = meta.get([group.program,group.unit,group.action].join('/'));
  const municipalityBudget = sum(group.rows.filter(row => valid.has(row['Código do Município IBGE'])).map(row => num(row[budgetField])));
  const totalBudget = sum(group.rows.map(row => num(row[budgetField])));
  const examples = [...new Map(qualified.map(row => [row['Código do Município IBGE'], { municipality:row.Município, ibge:row['Código do Município IBGE'], localizer:row['Código do Localizador'], physical:num(row[physicalField]), budget:num(row[budgetField]), sourceRow:row.sourceRow }])).values()].sort((a,b) => b.budget - a.budget);
  const counts = new Map(); for (const row of group.rows) counts.set(row['Código do Localizador'], (counts.get(row['Código do Localizador']) || 0) + 1);
  candidates.push({ projectCode:group.projectCode, project:group.project, program:group.program, programName:group.programName, action:group.action, actionName:group.actionName, unit:group.unit, unitName:group.unitName, year, product:actionMeta?.Produto, productCode:actionMeta?.['Código do Produto'], measure:actionMeta?.['Unidade de Medida do Produto'], municipalitiesWithBoth:municipalities.length, localizers:group.rows.length, duplicatedLocalizers:[...counts].filter(([,n]) => n > 1), totalBudget, actionBudget:num(actionMeta?.[budgetField]), municipalityBudget, stateBudget:sum(group.rows.filter(row => normalizeCode(row['Código da Região Geográfica Intermediária']) === '99').map(row => num(row[budgetField]))), municipalityPhysical:sum(group.rows.filter(row => valid.has(row['Código do Município IBGE'])).map(row => num(row[physicalField]))), actionPhysical:num(actionMeta?.[physicalField]), municipalShare:totalBudget > 0 ? municipalityBudget / totalBudget * 100 : null, examples:examples.slice(0,8) });
}
const current = candidates.filter(candidate => candidate.year === '2026').sort((a,b) => b.municipalitiesWithBoth - a.municipalitiesWithBoth || (b.municipalShare || 0) - (a.municipalShare || 0));
const future = candidates.filter(candidate => candidate.year !== '2026').sort((a,b) => b.municipalitiesWithBoth - a.municipalitiesWithBoth);
console.log('CONSULTA_MUNICIPAL_INICIO');
console.log(JSON.stringify({ source:'data/raw/plan2026/localizadores_Todos_planejamento.txt', rows:raw.length, strategicActions:groups.size, qualifiedActionYears:candidates.length, current:current.slice(0,10), otherYears:future.slice(0,4) }, null, 2));
console.log('CONSULTA_MUNICIPAL_FIM');
