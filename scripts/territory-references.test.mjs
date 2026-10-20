import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPlanningTargetReference, readPlanningBudgetReference } from './territory-planning-targets.mjs';
import { readPlanningTerritoryCatalog, buildPlanningTerritoryCatalog, planningCycleYears } from './territory-planning-catalog.mjs';
import { buildFjpRegionalizations } from './territory-fjp-regionalizations.mjs';
import { planningTargetSeries as allPlanningTargetSeries, planningBudgetSeries as allPlanningBudgetSeries, planningYears, planningCycle, planningTerritoryCatalog, catalogSeries, planningReferenceTotals, planningRegionalValues, isIntermediateScheme, budgetComparison, formatBudget } from '../src/services/planningTerritoryReference.ts';
import { referenceRegionalizations } from '../src/services/fjpTerritoryReference.ts';
import { canEditTerritory, enforceTerritoryUpdate } from '../src/services/territoryDomain.ts';
const planningTargetSeries = allPlanningTargetSeries.filter(s => s.reference.projectCode === '14');
const planningBudgetSeries = allPlanningBudgetSeries.filter(s => s.reference.projectCode === '14');
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

test('catálogo reproduz os TXT e preserva projetos, programas, ações, UOs e localizadores', () => {
  assert.deepEqual(readPlanningTerritoryCatalog(), planningTerritoryCatalog);
  assert.deepEqual(planningTerritoryCatalog.projects.map(p => p.code), ['14','56','64','20']);
  assert.equal(planningTerritoryCatalog.projects.flatMap(p => p.actions).length, 7);
  assert.equal(allPlanningTargetSeries.length, 28);
  assert.equal(allPlanningBudgetSeries.length, 28);
  assert.equal(new Set([...allPlanningTargetSeries,...allPlanningBudgetSeries].map(s => s.id)).size, 56);
  assert.deepEqual(planningTargetSeries, targetReference.series);
  assert.deepEqual(planningBudgetSeries, JSON.parse(readFileSync('data/territorio/recursos-reurb.json','utf8')).series);
  const capture = planningTerritoryCatalog.projects.find(p => p.code === '56');
  assert.deepEqual(capture.actions.map(a => [a.code,a.ownerUnit]), [['2067','1261'],['4155','1071']]);
  for (const s of [...allPlanningTargetSeries,...allPlanningBudgetSeries]) {
    assert.equal(new Set(s.reference.observations.map(o => o.localizerCode)).size, s.reference.observations.length);
    assert.equal(canEditTerritory({perfil:'Administrador',unidade:'1261 — SEE'}, s), false);
  }
});

test('os três projetos mantêm valores municipais conhecidos e totais físicos e financeiros', () => {
  const expected = [['2067',852,3408,15000000],['4157',87,1305,419732],['4416',56,56,320760]];
  for (const [code,count,physical,budget] of expected) {
    const p = allPlanningTargetSeries.find(s => s.reference.actionCode === code && s.period === '2026');
    const b = allPlanningBudgetSeries.find(s => s.reference.actionCode === code && s.period === '2026');
    assert.equal(Object.values(p.values).filter(v => v > 0).length, count);
    assert.equal(Object.values(b.values).filter(v => v > 0).length, count);
    assert.equal(p.reference.sourceTotal, physical);
    assert.equal(b.reference.sourceTotal, budget);
    assert.equal(p.reference.sourceTotal, p.reference.actionTotal);
    assert.equal(b.reference.sourceTotal, b.reference.actionTotal);
  }
  const physical = allPlanningTargetSeries.find(s => s.reference.actionCode === '2067' && s.period === '2026');
  const budget = allPlanningBudgetSeries.find(s => s.reference.actionCode === '2067' && s.period === '2026');
  assert.equal(physical.values['3106200'],225);
  assert.equal(budget.values['3106200'],990316);
  const health = referenceRegionalizations(data).find(s => s.id === 'fjp-health-micro');
  const sums = planningRegionalValues(data,budget,health);
  assert.equal(Object.values(sums).reduce((total,row) => total + (row.value ?? 0),0),15000000);
});

test('comparação financeira permanece dentro do projeto e não soma metas de produtos diferentes', () => {
  const capture = budgetComparison('2026',undefined,'56');
  assert.equal(capture.actions.length,2);
  assert.equal(capture.total,16731000);
  assert.ok(capture.actions.every(a => a.series.reference.projectCode === '56'));
  assert.equal(budgetComparison('2026',undefined,'64').total,419732);
  assert.equal(budgetComparison('2026',undefined,'20').total,344480);
});

test('ciclo parte da revisão, distingue elaboração e muda de ano sem reaproveitar valores antigos', () => {
  assert.deepEqual(planningCycle,{revisionYear:'2026',preparedIn:'2025',years:['2026','2027','2028','2029']});
  assert.deepEqual(planningYears('2030'),['2030','2031','2032','2033']);
  assert.deepEqual(planningCycleYears('2030'),planningYears('2030'));
  assert.throws(() => planningYears(''),/revisão/);
  const action = {'Código do Programa':'0005','Código da Unidade Orçamentária Responsável pela Ação':'01261','Código da Ação':'2067','Título da Ação':'Teste','Código do Identificador de Ação Governamental (IAG)':'1','Código do Projeto Estratégico':'56','Projeto Estratégico':'Projeto de teste','Produto':'Escola atendida','Código do Produto':'10664','Código da Unidade de Medida do Produto':'1','Unidade de Medida do Produto':'ESCOLA','Previsão Física 2030':'2','Previsão Orçamentária 2030':'100'};
  const row = {...action,'Código do Localizador':'teste','Código do Município IBGE':'3106200','Código da Região Geográfica Intermediária':'1',Município:'Belo Horizonte','Previsão Física 2026':'999','Previsão Orçamentária 2026':'999'};
  const next = buildPlanningTerritoryCatalog([row],[action],planningTerritoryCatalog.source,{revisionYear:'2030',preparedIn:'2029'},['3106200']);
  const series = catalogSeries(next,'physical-target');
  assert.deepEqual(series.map(s => s.period),['2030','2031','2032','2033']);
  assert.equal(series[0].values['3106200'],2);
  assert.equal(series[1].values['3106200'],null);
  assert.equal(planningReferenceTotals(series[1]).reconciled,false);
});
