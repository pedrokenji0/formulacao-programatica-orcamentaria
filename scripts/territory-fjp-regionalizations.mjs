import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildFjpRegionalizations(workbook, municipalityCatalog) {
  const sheet = workbook.sheets.find(sheet => sheet.name === 'Regionalização');
  if (!sheet) throw new Error('Aba Regionalização não encontrada.');
  const [headers, ...input] = sheet.rows;
  const rows = input.filter(row => row.some(value => String(value ?? '').trim())).map(row => Object.fromEntries(headers.map((header, i) => [header, row[i] ?? ''])));
  const codes = new Set(municipalityCatalog.map(m => m.code));
  if (rows.length !== 853 || new Set(rows.map(row => String(row.CODIGO_MUNICIPIO))).size !== 853 || rows.some(row => !codes.has(String(row.CODIGO_MUNICIPIO)))) throw new Error('A referência FJP deve conter os 853 códigos municipais válidos, sem duplicatas.');
  const definitions = [
    ['rm-ride', 'Regiões metropolitanas, colares e RIDE', 'IBGE', 'RMRIDE'],
    ['immediate', 'Regiões geográficas imediatas', 'IBGE', 'IMEDIATA'],
    ['intermediate', 'Regiões geográficas intermediárias', 'IBGE', 'INTERMEDIARIA'],
    ['health-micro', 'Microrregiões de Saúde', 'Saúde', 'REGSAUD'],
    ['health-macro', 'Macrorregiões de Saúde', 'Saúde', 'MACSAUD'],
    ['education-sre', 'Superintendências Regionais de Ensino', 'Educação', 'SRE'],
  ];
  const regionalizations = definitions.map(([key, name, department, column]) => {
    const memberships = {}, names = new Map();
    for (const row of rows) {
      const id = String(row['CODIGO_' + column] ?? '').trim(), label = String(row['NOME_' + column] ?? '').trim();
      if (!id && !label) continue;
      if (!id || !label || names.has(id) && names.get(id) !== label) throw new Error('Código e nome de região inconsistentes: ' + column + ' / ' + id);
      names.set(id, label); memberships[String(row.CODIGO_MUNICIPIO)] = id;
    }
    const duplicateNames = new Set([...names.values()].filter((label, i, all) => all.indexOf(label) !== i));
    return { id: 'fjp-' + key, name, department, ownerUnit: '', referenceYear: '2026', source: 'FJP/IMRS · edição 2026 · ' + sheet.name + ' · NOME_' + column, createdAt: workbook.fetchedAt,
      reference: { kind: 'fjp', edition: '2026', sourceUrl: workbook.sourceUrl, sourceHash: workbook.sha256, sheet: sheet.name, column: 'NOME_' + column },
      regions: [...names].map(([id, label]) => ({ id, name: duplicateNames.has(label) ? label + ' · ' + id : label })).sort((a,b) => a.name.localeCompare(b.name, 'pt-BR')), memberships };
  });
  return { schemaVersion: 1, source: { name: workbook.name, fileName: workbook.fileName, sourceUrl: workbook.sourceUrl, catalogUrl: workbook.catalogUrl, sha256: workbook.sha256, fetchedAt: workbook.fetchedAt, edition: '2026', access: 'public-fjp' }, regionalizations };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(readFileSync('data/territorio/fonte-regionalizacoes-fjp.json', 'utf8'));
  const catalog = JSON.parse(readFileSync('data/territorio/municipios.json', 'utf8'));
  writeFileSync('data/territorio/regionalizacoes-fjp.json', JSON.stringify(buildFjpRegionalizations(source, catalog), null, 2) + '\n');
}
