import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPlanningTargetReference } from './territory-planning-targets.mjs';
import { buildFjpRegionalizations } from './territory-fjp-regionalizations.mjs';
import { planningTargetSeries, physicalTargetTotals, physicalRegionalValues, isIntermediateScheme } from '../src/services/planningTerritoryReference.ts';
import { referenceRegionalizations } from '../src/services/fjpTerritoryReference.ts';
import { canEditTerritory, enforceTerritoryUpdate } from '../src/services/territoryDomain.ts';
const data = JSON.parse(readFileSync('public/data/mg-municipios.json', 'utf8'));
const targetReference = JSON.parse(readFileSync('data/territorio/metas-fisicas-reurb.json', 'utf8'));
const source = JSON.parse(readFileSync('data/territorio/fonte-regionalizacoes-fjp.json', 'utf8'));
const regionalReference = JSON.parse(readFileSync('data/territorio/regionalizacoes-fjp.json', 'utf8'));
const catalog = JSON.parse(readFileSync('data/territorio/municipios.json', 'utf8'));

test('as oito séries físicas reproduzem os localizadores e mantêm ação, UO, produto e ano', () => {
  assert.deepEqual(readPlanningTargetReference(), targetReference);
  assert.equal(planningTargetSeries.length, 8);
  assert.deepEqual([...new Set(planningTargetSeries.map(s => s.period))], ['2026','2027','2028','2029']);
  assert.deepEqual([...new Set(planningTargetSeries.map(s => s.ownerUnit))], ['1221','2461']);
  for (const series of planningTargetSeries) {
    assert.equal(series.unit, 'UNIDADE');
    assert.equal(series.reference.productCode, '12452');
    assert.equal(series.reference.sourceTotal, series.reference.actionTotal);
    assert.equal(series.reference.field, 'Previsão Física ' + series.period);
    assert.ok(series.reference.observations.every(row => row.sourceRow > 2));
  }
  assert.equal(JSON.stringify(targetReference).includes('Previsão Orçamentária'), false);
});

test('metas estaduais e regionais ficam separadas e não viram valores municipais', () => {
  const scheme = referenceRegionalizations(data).find(s => s.id === 'ibge-intermediate');
  const sede = planningTargetSeries.find(s => s.reference.actionCode === '1082' && s.period === '2026');
  assert.deepEqual(physicalTargetTotals(sede), { total:17166, actionTotal:17166, municipality:null, intermediate:300, state:16866, reconciled:true });
  assert.equal(Object.values(sede.values).filter(value => value !== null).length, 0);
  const regions = physicalRegionalValues(data, sede, scheme);
  assert.equal(regions['3102'].value, 300);
  assert.equal(regions['3102'].observed, 0);
  assert.equal(regions['3102'].declaredRegional, true);
  assert.equal(regions['3101'].value, null);
  const armva = planningTargetSeries.find(s => s.reference.actionCode === '4528' && s.period === '2026');
  assert.equal(physicalRegionalValues(data, armva, scheme)['3105'].value, 1500);
  assert.deepEqual(armva.values, {});
});

test('zero estadual previsto em anos futuros não preenche regiões ou municípios sem valor', () => {
  const series = planningTargetSeries.find(s => s.reference.actionCode === '1082' && s.period === '2027');
  assert.equal(physicalTargetTotals(series).state, 0);
  assert.equal(physicalTargetTotals(series).total, 0);
  assert.ok(Object.values(series.values).every(value => value === null));
  const scheme = referenceRegionalizations(data).find(s => s.id === 'ibge-intermediate');
  assert.ok(Object.values(physicalRegionalValues(data, series, scheme)).every(row => row.value === null));
});

test('regionalizações FJP reproduzem a planilha e preservam códigos e cobertura parcial', () => {
  assert.deepEqual(buildFjpRegionalizations(source, catalog), regionalReference);
  assert.deepEqual(regionalReference.regionalizations.map(s => [s.id, s.regions.length, Object.keys(s.memberships).length]), [
    ['fjp-rm-ride',5,82], ['fjp-immediate',70,853], ['fjp-intermediate',13,853], ['fjp-health-micro',89,853], ['fjp-health-macro',16,853], ['fjp-education-sre',47,853],
  ]);
  const ride = regionalReference.regionalizations.find(s => s.id === 'fjp-rm-ride');
  assert.ok(ride.regions.some(r => r.id === '04602'));
  const schemes = referenceRegionalizations(data);
  assert.equal(schemes.length, 6);
  assert.equal(new Set(schemes.map(s => s.id)).size, 6);
  assert.equal(schemes.filter(s => s.name === 'Regiões geográficas intermediárias').length, 1);
});

test('metas de regiões intermediárias não são redistribuídas a recortes de Saúde ou Ensino', () => {
  const series = planningTargetSeries.find(s => s.reference.actionCode === '4528' && s.period === '2026');
  const schemes = referenceRegionalizations(data);
  assert.equal(isIntermediateScheme(data, schemes.find(s => s.id === 'ibge-intermediate')), true);
  for (const id of ['fjp-health-micro', 'fjp-health-macro', 'fjp-education-sre']) {
    const scheme = schemes.find(s => s.id === id);
    assert.equal(isIntermediateScheme(data, scheme), false);
    assert.ok(Object.values(physicalRegionalValues(data, series, scheme)).every(row => row.value === null && row.declaredRegional === false));
  }
});

test('referências PPO e FJP permanecem protegidas mesmo para perfis de edição', () => {
  const state = { perfil:'Administrador', unidade:'1221 — SEDE' };
  assert.equal(canEditTerritory(state, planningTargetSeries[0]), false);
  assert.equal(canEditTerritory(state, referenceRegionalizations(data)[0]), false);
  const next = { ...state, territory: { schemaVersion:1, regionalizations:[], series:[structuredClone(planningTargetSeries[0])] } };
  assert.throws(() => enforceTerritoryUpdate(state, next), /protegidas/);
});
