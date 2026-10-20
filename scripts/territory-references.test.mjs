import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPlanningTargetReference, readPlanningBudgetReference } from './territory-planning-targets.mjs';
import { buildFjpRegionalizations } from './territory-fjp-regionalizations.mjs';
import { planningTargetSeries, planningBudgetSeries, planningReferenceTotals, planningRegionalValues, isIntermediateScheme, budgetComparison, formatBudget } from '../src/services/planningTerritoryReference.ts';
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
  assert.deepEqual(planningReferenceTotals(sede), { total:17166, actionTotal:17166, municipality:null, intermediate:300, state:16866, reconciled:true });
  assert.equal(Object.values(sede.values).filter(value => value !== null).length, 0);
  const regions = planningRegionalValues(data, sede, scheme);
  assert.equal(regions['3102'].value, 300);
  assert.equal(regions['3102'].observed, 0);
  assert.equal(regions['3102'].declaredRegional, true);
  assert.equal(regions['3101'].value, null);
  const armva = planningTargetSeries.find(s => s.reference.actionCode === '4528' && s.period === '2026');
  assert.equal(planningRegionalValues(data, armva, scheme)['3105'].value, 1500);
  assert.deepEqual(armva.values, {});
});

test('zero estadual previsto em anos futuros não preenche regiões ou municípios sem valor', () => {
  const series = planningTargetSeries.find(s => s.reference.actionCode === '1082' && s.period === '2027');
  assert.equal(planningReferenceTotals(series).state, 0);
  assert.equal(planningReferenceTotals(series).total, 0);
  assert.ok(Object.values(series.values).every(value => value === null));
  const scheme = referenceRegionalizations(data).find(s => s.id === 'ibge-intermediate');
  assert.ok(Object.values(planningRegionalValues(data, series, scheme)).every(row => row.value === null));
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
    assert.ok(Object.values(planningRegionalValues(data, series, scheme)).every(row => row.value === null && row.declaredRegional === false));
  }
});

test('referências PPO e FJP permanecem protegidas mesmo para perfis de edição', () => {
  const state = { perfil:'Administrador', unidade:'1221 — SEDE' };
  assert.equal(canEditTerritory(state, planningTargetSeries[0]), false);
  assert.equal(canEditTerritory(state, referenceRegionalizations(data)[0]), false);
  const next = { ...state, territory: { schemaVersion:1, regionalizations:[], series:[structuredClone(planningTargetSeries[0])] } };
  assert.throws(() => enforceTerritoryUpdate(state, next), /protegidas/);
});

test('a edição vem da descrição da fonte e não do ano corrente ou do período do indicador', () => {
  const next = buildFjpRegionalizations({ ...source, description:'Regionalizações dos municípios de Minas Gerais (edição 2027).' }, catalog);
  assert.equal(next.source.edition, '2027');
  assert.ok(next.regionalizations.every(scheme => scheme.referenceYear === '2027'));
  assert.throws(() => buildFjpRegionalizations({ ...source, description:'' }, catalog), /edição/);
});

test('as oito previsões orçamentárias conferem com a fonte e os totais de cada ação', () => {
  const budget = JSON.parse(readFileSync('data/territorio/recursos-reurb.json', 'utf8'));
  assert.deepEqual(readPlanningBudgetReference(), budget);
  assert.equal(planningBudgetSeries.length, 8);
  assert.equal(new Set([...planningTargetSeries, ...planningBudgetSeries].map(s => s.id)).size, 16);
  const expected = { '1082': [48281208,0,0,0], '4528': [16545637,3040033,3174098,3314076] };
  for (const s of planningBudgetSeries) {
    assert.equal(s.unit, 'R$');
    assert.equal(s.reference.kind, 'budget-forecast');
    assert.equal(s.reference.unitCode, 'BRL');
    assert.equal(s.reference.sourceTotal, expected[s.reference.actionCode][Number(s.period) - 2026]);
    assert.equal(s.reference.actionTotal, s.reference.sourceTotal);
    assert.equal(s.reference.field, 'Previsão Orçamentária ' + s.period);
    assert.equal(s.reference.sourceBlobSha, targetReference.source.localizers.blobSha);
    assert.equal(canEditTerritory({ perfil:'Administrador', unidade:'1221 — SEDE' }, s), false);
    assert.equal(s.indicatorRef, null);
  }
});

test('recursos estaduais, regionais e ausentes mantêm abrangência e não viram rateio municipal', () => {
  const sede = planningBudgetSeries.find(s => s.reference.actionCode === '1082' && s.period === '2026');
  const armva = planningBudgetSeries.find(s => s.reference.actionCode === '4528' && s.period === '2026');
  assert.deepEqual(planningReferenceTotals(sede), { total:48281208, actionTotal:48281208, municipality:null, intermediate:780000, state:47501208, reconciled:true });
  assert.deepEqual(planningReferenceTotals(armva), { total:16545637, actionTotal:16545637, municipality:null, intermediate:16545637, state:null, reconciled:true });
  const schemes = referenceRegionalizations(data);
  const intermediate = schemes.find(s => s.id === 'ibge-intermediate');
  assert.equal(planningRegionalValues(data, sede, intermediate)['3102'].value, 780000);
  assert.equal(planningRegionalValues(data, sede, intermediate)['3101'].value, null);
  assert.equal(planningRegionalValues(data, armva, intermediate)['3105'].value, 16545637);
  assert.ok(Object.values(sede.values).every(value => value === null));
  assert.deepEqual(armva.values, {});
  const next = planningBudgetSeries.find(s => s.reference.actionCode === '1082' && s.period === '2027');
  assert.equal(planningReferenceTotals(next).state, 0);
  assert.ok(Object.values(planningRegionalValues(data, next, intermediate)).every(row => row.value === null));
  assert.ok(Object.values(planningRegionalValues(data, armva, schemes.find(s => s.id === 'fjp-health-micro'))).every(row => row.value === null));
});

test('participação compara somente o mesmo ano e não divide por zero nem omite ausência', () => {
  const current = budgetComparison('2026');
  assert.equal(current.total, 64826845);
  assert.equal(current.complete, true);
  assert.ok(Math.abs(current.actions.reduce((sum, a) => sum + a.share, 0) - 100) < 1e-10);
  assert.ok(Math.abs(current.actions[0].share - 48281208 / 64826845 * 100) < 1e-10);
  assert.equal(budgetComparison('2027').total, 3040033);
  assert.deepEqual(budgetComparison('2027').actions.map(a => a.share), [0,100]);
  const zero = current.actions.map(({ series }) => ({ ...series, reference:{ ...series.reference, sourceTotal:0 } }));
  assert.equal(budgetComparison('2026', zero).total, 0);
  assert.ok(budgetComparison('2026', zero).actions.every(a => a.share === null));
  const missing = zero.map(s => ({ ...s, reference:{ ...s.reference, sourceTotal:null } }));
  assert.equal(budgetComparison('2026', missing).total, null);
  assert.equal(budgetComparison('2026', missing).complete, false);
  assert.ok(budgetComparison('2026', missing).actions.every(a => a.share === null));
  assert.equal(formatBudget(null), 'Sem dados');
  assert.match(formatBudget(0), /0,00/);
  assert.match(formatBudget(48281208), /48\.281\.208,00/);
});
