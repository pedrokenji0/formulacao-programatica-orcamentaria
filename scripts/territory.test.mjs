import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTerritory } from './territory-build.mjs';
import { canEditTerritory, colorScale, createRegionalization, createTerritorialSeries, enforceTerritoryUpdate, ibgeRegionalizations, NO_DATA_COLOR, parseTerritorialRows, parseTerritoryNumber, regionalValues, assignMunicipalities, validateTerritoryDataset } from '../src/services/territoryDomain.ts';
import { decodeState, encodeState } from '../src/services/planningPersistence.ts';
const data = JSON.parse(readFileSync('public/data/mg-municipios.json', 'utf8'));
const source = JSON.parse(readFileSync('data/territorio/fonte-ibge.json', 'utf8'));
const state = () => ({ schemaVersion: 2, perfil: 'Gestor Setorial', unidade: '01221 - SEDE', currentProgramId: 'programa',
  programs: [{ id: 'programa' }], actions: [], maps: [], projectMaps: [], frameworks: [], budgetItems: [], links: [], mirrors: [], support: {}, lists: {},
  planning: { datasetId: 'teste', exercise: '2026', indicatorProposals: {}, localIndicators: [], localizerProposals: {}, justifications: {}, migrationNotices: [] } });
const seriesInput = (rows) => ({ name: 'Indicador de teste', period: '2025', unit: '%', source: 'Planilha informada', indicatorRef: null, aggregation: 'none', rows });

test('malha publicada reproduz a fonte IBGE e contém os 853 municípios com geometria válida', () => {
  assert.deepEqual(buildTerritory(source), data);
  validateTerritoryDataset(data);
  assert.equal(data.municipalities.find((m) => m.code === '3106200').name, 'Belo Horizonte');
  for (const m of data.municipalities) {
    assert.ok(/^M[\d.,LZ]+$/.test(m.path));
    assert.ok(m.bounds[0] >= 0 && m.bounds[1] >= 0 && m.bounds[2] <= data.width && m.bounds[3] <= data.height);
  }
  const schemes = ibgeRegionalizations(data);
  assert.deepEqual(schemes.map((scheme) => scheme.regions.length), [13, 70]);
  assert.ok(schemes.every((scheme) => Object.keys(scheme.memberships).length === 853));
  assert.throws(() => validateTerritoryDataset({ ...data, municipalities: data.municipalities.slice(1) }), /853/);
});

test('importação territorial exige código IBGE e rejeita município repetido, desconhecido e linha inválida', () => {
  assert.throws(() => parseTerritorialRows([{ codigo_ibge: '3199999', valor: 1 }], data, 'series'), /não reconhecido/);
  assert.throws(() => parseTerritorialRows([{ codigo_ibge: '3106200', valor: 1 }, { codigo_ibge: '3106200', valor: 2 }], data, 'series'), /repetido/);
  assert.throws(() => parseTerritorialRows([{ codigo_ibge: '3106200', regiao: '' }], data, 'regions'), /região/);
  assert.throws(() => parseTerritorialRows([{ codigo_ibge: '3106200', outro: 1 }], data, 'series'), /Coluna valor/);
  assert.throws(() => parseTerritorialRows([{ codigo_ibge: '3106200', valor: 'não informado' }], data, 'series'), /numérico/);
});

test('ausência, zero, negativos e decimais permanecem distintos na leitura e na cor', () => {
  const records = parseTerritorialRows([{ codigo_ibge: '3106200', valor: 0 }, { codigo_ibge: '3100104', valor: '' }, { codigo_ibge: '3100203', valor: '1.234,50' }], data, 'series');
  assert.deepEqual(records.map((item) => item.value), [0, null, 1234.5]);
  assert.equal(parseTerritoryNumber('-2,5'), -2.5);
  const scale = colorScale([0, null, 10, 20]);
  assert.notEqual(scale.color(0), NO_DATA_COLOR);
  assert.equal(scale.color(null), NO_DATA_COLOR); assert.equal(scale.color(undefined), NO_DATA_COLOR);
  assert.notEqual(scale.color(0), scale.color(20));
  assert.equal(colorScale([0, 0], 'quantile').bins.length, 1);
  assert.equal(colorScale([null]).bins.length, 0);
  assert.ok(colorScale([0, 0, 0, 10], 'quantile').bins.every((bin) => Number.isFinite(bin.upper)));
});

test('cada secretaria mantém sua regionalização sem alterar o município ou a divisão de outra secretaria', () => {
  const app = state();
  const first = createRegionalization(app, data, { name: 'Saúde', department: 'SES', referenceYear: '2026', source: 'Teste', rows: [{ codigo_ibge: '3106200', regiao: 'Centro' }] });
  const second = createRegionalization(app, data, { name: 'Educação', department: 'SEE', referenceYear: '2026', source: 'Teste', rows: [{ codigo_ibge: '3106200', regiao: 'Metropolitana' }] });
  assert.notEqual(first.id, second.id); assert.equal(first.ownerUnit, '1221');
  first.regions.push({ id: 'norte', name: 'Norte' });
  assignMunicipalities(first, ['3106200'], 'norte', data);
  assert.equal(first.memberships['3106200'], 'norte');
  assert.equal(second.regions.find((r) => r.id === second.memberships['3106200']).name, 'Metropolitana');
  assert.throws(() => assignMunicipalities(first, ['3199999'], 'norte', data), /não encontrado/);
});

test('agregação regional é explícita e informa cobertura, sem transformar ausência em zero', () => {
  const app = state(), scheme = createRegionalization(app, data, { name: 'Teste', department: 'SES', referenceYear: '2026', source: 'Teste', rows: [{ codigo_ibge: '3106200', regiao: 'A' }, { codigo_ibge: '3100104', regiao: 'A' }, { codigo_ibge: '3100203', regiao: 'A' }] });
  const series = createTerritorialSeries(app, data, seriesInput([{ codigo_ibge: '3106200', valor: 0 }, { codigo_ibge: '3100104', valor: 20 }]));
  const region = scheme.regions[0].id;
  assert.deepEqual(regionalValues(data, series, scheme)[region], { value: null, observed: 2, total: 3 });
  series.aggregation = 'mean'; assert.equal(regionalValues(data, series, scheme)[region].value, 10);
  series.aggregation = 'sum'; assert.equal(regionalValues(data, series, scheme)[region].value, 20);
});

test('séries e regionalizações persistem junto da proposta e preservam permissões por perfil e UO', () => {
  const baseline = state(), app = state();
  const series = createTerritorialSeries(app, data, seriesInput([{ codigo_ibge: '3106200', valor: 0 }]));
  const scheme = createRegionalization(app, data, { name: 'Teste', department: 'SES', referenceYear: '2026', source: 'Manual' });
  app.territory = { schemaVersion: 1, series: [series], regionalizations: [scheme] };
  enforceTerritoryUpdate(baseline, app);
  const restored = decodeState(encodeState(app, baseline), baseline);
  assert.deepEqual(restored.territory, app.territory);
  const older = JSON.parse(encodeState(baseline, baseline)); delete older.values.territory;
  assert.equal(decodeState(JSON.stringify(older), baseline).territory, undefined);
  for (const perfil of ['Leitor', 'Consulta', 'DCMEFO/SEPLAG']) {
    const readOnly = { ...app, perfil };
    assert.equal(canEditTerritory(readOnly, series), false);
    const next = structuredClone(readOnly); next.territory.series[0].values['3106200'] = 99;
    assert.throws(() => enforceTerritoryUpdate(readOnly, next), /permissão/);
  }
  const other = { ...app, perfil: 'Gestor UA', unidade: '1261 — SEE' }, next = structuredClone(other);
  next.territory.series[0].values['3106200'] = 100;
  assert.throws(() => enforceTerritoryUpdate(other, next), /permissão/);
  const invalid = structuredClone(app); invalid.territory.series[0].values['3199999'] = 0;
  assert.throws(() => enforceTerritoryUpdate(app, invalid), /inválido/);
  const forged = structuredClone(app); forged.territory.series[0].indicatorRef = { kind: 'ppo', indicatorId: 'ppo-indicador-inexistente' };
  assert.throws(() => enforceTerritoryUpdate(app, forged), /não encontrado/);
});
