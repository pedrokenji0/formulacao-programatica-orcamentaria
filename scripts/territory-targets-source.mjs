import * as XLSX from 'xlsx';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildFjpRegionalizations } from './territory-fjp-regionalizations.mjs';
import { readPlanningTargetReference } from './territory-planning-targets.mjs';

const catalogUrl = 'https://apiimrs.fjp.mg.gov.br/info/collections/all';
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(response.status + ': ' + url);
  return response;
}
const catalog = await (await get(catalogUrl)).json();
const file = catalog.message.find(item => item.slug === 'regionalizacoes-dos-municipios-de-minas-gerais');
if (!file) throw new Error('Planilha de regionalizações não encontrada no acervo público FJP.');
const sourceUrl = new URL(file.pathfile, 'https://imrs.fjp.mg.gov.br').href;
const bytes = Buffer.from(await (await get(sourceUrl)).arrayBuffer());
const workbook = XLSX.read(bytes, { type: 'buffer' });
const source = { sourceUrl, name: file.name, fileName: file.slug + '.' + file.ext, description: file.description, sha256: createHash('sha256').update(bytes).digest('hex'), fetchedAt: new Date().toISOString(), catalogUrl, sheets: workbook.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: true }) })) };
const municipalities = JSON.parse(readFileSync('data/territorio/municipios.json', 'utf8'));
const regionalizations = buildFjpRegionalizations(source, municipalities);
const targets = readPlanningTargetReference();
writeFileSync('data/territorio/fonte-regionalizacoes-fjp.json', JSON.stringify(source, null, 2) + '\n');
writeFileSync('data/territorio/regionalizacoes-fjp.json', JSON.stringify(regionalizations, null, 2) + '\n');
writeFileSync('data/territorio/metas-fisicas-reurb.json', JSON.stringify(targets, null, 2) + '\n');
console.log('Atualizadas ' + regionalizations.regionalizations.length + ' regionalizações e ' + targets.series.length + ' séries de metas físicas. Confira e versione as alterações.');
