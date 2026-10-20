import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePipe } from './planning-import.mjs';

export function buildPlanningTargetReference(localizers, actions, source) {
  const code = value => String(value ?? '').replace(/^0+(?=\d)/, '');
  const active = row => !['Exclusão Lógica do Programa', 'Exclusão Lógica da Ação', 'Exclusão Lógica do Localizador'].some(key => /^(sim|true|1)$/i.test(String(row[key] || '').trim()));
  const number = value => value === undefined || String(value).trim() === '' ? null : Number(String(value).replace(',', '.'));
  const sum = values => { const known = values.filter(value => value !== null); return known.length ? known.reduce((total, value) => total + value, 0) : null; };
  const selected = actions.filter(row => code(row['Código do Programa']) === '125' && code(row['Código do Projeto Estratégico']) === '14' && ['1082', '4528'].includes(code(row['Código da Ação'])) && active(row));
  const series = [];
  for (const action of selected) {
    const actionCode = code(action['Código da Ação']), ownerUnit = code(action['Código da Unidade Orçamentária Responsável pela Ação']);
    const actionId = 'ppo-acao-125-' + ownerUnit + '-' + actionCode;
    const rows = localizers.map((row, index) => ({ row, sourceRow: index + 2 })).filter(({ row }) => code(row['Código do Programa']) === '125' && code(row['Código da Ação']) === actionCode && code(row['Código da Unidade Orçamentária Responsável pela Ação']) === ownerUnit && active(row));
    const years = [...new Set(rows.flatMap(({ row }) => Object.keys(row).map(key => /^Previsão Física (\d{4})$/.exec(key)?.[1]).filter(Boolean)))].sort();
    for (const year of years) {
      const field = 'Previsão Física ' + year;
      const observations = rows.map(({ row, sourceRow }) => {
        const rawCode = String(row['Código do Município IBGE'] || '').trim();
        const region = code(row['Código da Região Geográfica Intermediária']);
        const scope = rawCode === '3199999' || region === '99' ? 'state' : /^31999\d{2}$/.test(rawCode) && Number(region) >= 1 && Number(region) <= 13 ? 'intermediate' : 'municipality';
        const territoryCode = scope === 'state' ? '31' : scope === 'intermediate' ? '31' + region.padStart(2, '0') : rawCode;
        const value = number(row[field]);
        if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error('Meta física inválida: ' + row['Código do Localizador']);
        return { localizerCode: row['Código do Localizador'], scope, territoryCode, territoryName: row.Município || row['Região Geográfica Intermediária'], value, sourceRow };
      });
      const values = {};
      for (const observation of observations.filter(row => row.scope === 'municipality')) {
        if (!/^31\d{5}$/.test(observation.territoryCode)) throw new Error('Código municipal inválido.');
        values[observation.territoryCode] = sum(observations.filter(row => row.scope === 'municipality' && row.territoryCode === observation.territoryCode).map(row => row.value));
      }
      const seen = new Set();
      for (const observation of observations) {
        if (seen.has(observation.localizerCode)) throw new Error('Localizador repetido: confira a granularidade antes de somar.');
        seen.add(observation.localizerCode);
      }
      const sourceTotal = sum(observations.map(row => row.value)), actionTotal = number(action[field]);
      series.push({ id: 'ppo-meta-fisica-125-' + ownerUnit + '-' + actionCode + '-' + year, name: 'Meta física prevista — ação ' + actionCode + ' (' + action['Título da Ação'] + ')', period: year, unit: action['Unidade de Medida do Produto'], source: 'PPO · localizadores · ' + field, ownerUnit, createdAt: '', indicatorRef: null, aggregation: 'sum', values,
        reference: { kind: 'physical-target', actionId, actionCode, programId: 'ppo-programa-125', projectCode: '14', productCode: action['Código do Produto'], product: action.Produto, unitCode: action['Código da Unidade de Medida do Produto'], field, observations, sourceTotal, actionTotal, sourcePath: source.localizers.path, sourceBlobSha: source.localizers.blobSha } });
    }
  }
  return { schemaVersion: 1, source, series };
}
export function readPlanningTargetReference() {
  const localizerPath = 'data/raw/plan2026/localizadores_Todos_planejamento.txt', actionPath = 'data/raw/plan2026/acoes_planejamento.txt';
  const localizers = readFileSync(localizerPath), actions = readFileSync(actionPath);
  const blob = bytes => createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes])).digest('hex');
  return buildPlanningTargetReference(parsePipe(new TextDecoder('windows-1252').decode(localizers)).rows, parsePipe(new TextDecoder('windows-1252').decode(actions)).rows, {
    localizers: { path: localizerPath, blobSha: blob(localizers) }, actions: { path: actionPath, blobSha: blob(actions) },
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reference = readPlanningTargetReference();
  writeFileSync('data/territorio/metas-fisicas-reurb.json', JSON.stringify(reference, null, 2) + '\n');
  console.log('Metas físicas Reurb: ' + reference.series.length + ' séries.');
}
