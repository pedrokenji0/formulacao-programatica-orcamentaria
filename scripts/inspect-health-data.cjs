const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const root = path.resolve(__dirname, '..');
const split = (line) => line.replace(/^\uFEFF/, '').split('|');
const readPipe = (file) => {
  const raw = fs.readFileSync(path.join(root, file), 'latin1');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = split(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
};

const rows = readPipe('acoes_planejamento.txt');
const health = rows.filter((r) =>
  r['Setor de Governo'] === 'SAÚDE'
  || r['Área Temática'] === 'Saúde'
  || r['Unidade Orçamentária Responsável pela Ação'] === 'FUNDO ESTADUAL DE SAÚDE'
  || r['Código da Unidade Orçamentária Responsável pela Ação'] === '04291'
);
const healthPrograms = new Map();
const healthActions = new Map();
for (const r of health) {
  healthPrograms.set(r['Código do Programa'], r['Nome do Programa']);
  healthActions.set(`${r['Código do Programa']}|${r['Código da Ação']}`, r['Título da Ação']);
}

const seed = JSON.parse(fs.readFileSync(path.join(root, 'src/data/seed.json'), 'utf8'));
const obzCounts = {};
for (const it of seed.obzItems || []) obzCounts[it.org] = (obzCounts[it.org] || 0) + 1;

console.log(JSON.stringify({
  planejamento: {
    linhasSaude: health.length,
    programasSaude: healthPrograms.size,
    acoesSaude: healthActions.size,
    primeirosProgramas: Array.from(healthPrograms).slice(0, 12),
    primeirasAcoes: Array.from(healthActions).slice(0, 12),
  },
  obzSeed: {
    total: (seed.obzItems || []).length,
    porOrgao: obzCounts,
  },
  xlsx: ['1261.xlsx', '1451.xlsx', '1501.xlsx', '4291.xlsx', 'Tabelas_orcamentarias 10_06_2026.xlsx'].map((file) => {
    const wb = XLSX.readFile(path.join(root, file), { bookSheets: true });
    return { file, sheets: wb.SheetNames };
  }),
}, null, 2));

const wb4291 = XLSX.readFile(path.join(root, '4291.xlsx'), { cellDates: false, defval: '' });
for (const sheetName of ['AÇÕES E PROGRAMAS', 'BASE OBZ', 'ELEMENTO', 'AGRUPAMENTO', 'FONTE 2.0']) {
  const rows = XLSX.utils.sheet_to_json(wb4291.Sheets[sheetName], { header: 1, blankrows: false, defval: '' });
  console.log(`\n--- 4291.xlsx / ${sheetName} ---`);
  console.log(JSON.stringify(rows.slice(0, 12), null, 2));
}
