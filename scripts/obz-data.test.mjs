import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseBudgetNumber, calculateBudgetTotal, effectiveBudgetTotal, codeOf, unitCode, autoMapBudgetHeaders, buildBudgetImport, applyBudgetImport, reconcileBudgetItem, createHealthBudgetItems, migrateBudgetData, enforceBudgetUpdate, budgetPriorityIssues, OBZ_BACKUP_KEY } from '../src/services/obzData.ts';
import { encodeState, decodeState, readPersisted, STORAGE_KEY } from '../src/services/planningPersistence.ts';

const programs = [{ id: 'p125', codigo: '0125' }, { id: 'p88', codigo: '0088' }];
const actions = [
  { id: 'sede', programaId: 'p125', codigo: '1082', codigoUnidadeOrcamentaria: '01221' },
  { id: 'outra-uo', programaId: 'p125', codigo: '1082', codigoUnidadeOrcamentaria: '02461' },
];
const catalog = { programs, actions, exercise: '2026' };
const headers = ['UO','PROGRAMA','AÇÃO','DESCRIÇÃO DO ITEM','VOLUME','PREÇO UNITÁRIO','FREQUÊNCIA','VALOR TOTAL ITEM','CLASSIFICAÇÃO CENÁRIO','EXERCÍCIO'];
const mapping = autoMapBudgetHeaders(headers);
const options = { batchId: 'hash-a', file: 'planilha.xlsx', sheet: 'BASE OBZ', headers };
const row = ['01221 - SEDE','0125 - Programa','1082 - Ação','Item de teste',2,30,12,0,'LIMIAR','2026'];
const build = (values = row, changes = {}) => buildBudgetImport([headers,values],0,mapping,{...options,...changes},catalog);
const initial = () => ({ schemaVersion:2, perfil:'Administrador', unidade:'01221 - SEDE', currentProgramId:'p125', programs, actions,
  budgetItems:[], maps:[], frameworks:[], projectMaps:[], mirrors:[], links:[], support:{}, lists:{},
  planning:{datasetId:'test',exercise:'2026',indicatorProposals:{},localIndicators:[],localizerProposals:{},justifications:{},migrationNotices:[],editingVersion:1,obzDataVersion:1} });

test('números pt-BR e células numéricas preservam zeros, centavos, ausência e erros', () => {
  for (const [input, expected] of [[0,0],['0',0],['R$ 1.234,56',1234.56],['1.234.567,89',1234567.89],['1,234,567.89',1234567.89],['1234.56',1234.56],['1.234',1234],[1.234,1.234],['(1.234,50)',-1234.5],['-42,2',-42.2],['',null],[null,null],['não informado',null],['1.2.3',null],[Infinity,null],['12abc',null]]) assert.equal(parseBudgetNumber(input),expected,String(input));
  assert.equal(calculateBudgetTotal(2,30,12),720);
  assert.equal(calculateBudgetTotal(null,30,12),null);
  assert.equal(calculateBudgetTotal(0,30,12),0);
  assert.equal(calculateBudgetTotal(1e308,1e308,12),null);
});
test('códigos e cabeçalhos são normalizados sem misturar UOs', () => {
  assert.equal(codeOf('000125 — Programa'),'125');
  assert.equal(codeOf('Sem código'),'');
  assert.equal(unitCode('FUNED'),'2261');
  assert.equal(unitCode('FHEMIG'),'2271');
  assert.equal(unitCode('ESPMG'),'1541');
  assert.equal(unitCode('HEMOMINAS'),'2321');
  assert.equal(autoMapBudgetHeaders(['UNIDADE ORCAMENTARIA','ACAO','Descricao do item']).unidadeOrcamentaria,0);
});
test('zero declarado não é substituído pelo cálculo e ausência não vira frequência 1', () => {
  const item=build().items[0];
  assert.equal(item.valorTotal,0); assert.equal(item.source.numbers.valorTotal,0); assert.equal(item.totalMode,'declarado');
  assert.ok(item.dataIssues.some(x=>x.includes('difere')));
  const values=[...row]; values[6]=''; values[7]='';
  const missing=build(values).items[0];
  assert.equal(missing.quantities.frequenciaPagamento,null);
  assert.equal(missing.totalMode,'ausente'); assert.equal(effectiveBudgetTotal(missing),null);
});
test('vínculo exige exercício, programa, UO e ação; programa selecionado não é utilizado', () => {
  const item=build().items[0]; assert.equal(item.actionId,'sede'); assert.equal(item.programaId,'p125');
  const other=[...row];other[0]='02461 - ARMVA';
  assert.equal(build(other).items[0].actionId,'outra-uo');
  const missingYear=[...row];missingYear[9]='';
  const pending=build(missingYear).items[0];assert.equal(pending.actionId,'');assert.equal(pending.programaId,'');assert.equal(pending.exercise,null);assert.deepEqual(pending.linkage.candidates,['sede']);
  const oldYear=[...row];oldYear[9]='2025';
  assert.equal(build(oldYear).items[0].linkage.status,'outro-exercicio');
  const missingUnit=[...row];missingUnit[0]='';
  assert.equal(build(missingUnit).items[0].actionId,'');
  const duplicate={...catalog,actions:[...actions,{...actions[0],id:'segunda-sede'}]};
  assert.equal(reconcileBudgetItem(item,duplicate).linkage.status,'ambiguo');
});
test('ano de arquivo não é exercício e informação explícita não sobrescreve coluna existente', () => {
  const values=[...row];values[9]='';
  const missing=build(values,{file:'orcamento-2027.xlsx'}).items[0];assert.equal(missing.exercise,null);
  assert.equal(build(values,{exercise:'2026'}).items[0].linkage.status,'vinculado');
  assert.equal(build(row,{exercise:'2027'}).items[0].exercise,'2026');
  const invalid=[...row];invalid[9]='20x6';
  assert.equal(build(invalid,{exercise:'2026'}).items[0].exercise,null);
});
test('identidade de importação inclui conteúdo, aba e linha; reimportar preserva edições', () => {
  const first=build().items[0], again=build().items[0], other=build(row,{batchId:'hash-b'}).items[0];
  assert.equal(first.id,again.id);assert.notEqual(first.id,other.id);
  assert.notEqual(first.id,build(row,{sheet:'OUTRA'}).items[0].id);
  const state=initial();assert.deepEqual(applyBudgetImport(state,[first]),{added:1,skipped:0});
  state.budgetItems[0].descricao='Revisão local';
  assert.deepEqual(applyBudgetImport(state,[again]),{added:0,skipped:1});assert.equal(state.budgetItems[0].descricao,'Revisão local');
  const ua=initial();ua.perfil='Gestor UA';assert.throws(()=>applyBudgetImport(ua,[first,build(['02461 - ARMVA',...row.slice(1)],{batchId:'hash-b'}).items[0]]),/outra UO/);assert.equal(ua.budgetItems.length,0);
  const reader=initial();reader.perfil='Leitor';assert.throws(()=>applyBudgetImport(reader,[first]),/permissão/);
});
test('linha e células originais são preservadas; mapeamento duplicado não importa dados cruzados', () => {
  const original=build(row,{rowOffset:3}).items[0];
  assert.equal(original.source.row,5);assert.deepEqual(original.source.raw.cells,row);
  assert.throws(()=>buildBudgetImport([headers,row],0,{...mapping,programa:mapping.acao},options,catalog),/dois campos/);
  const values=[...row];values[3]='';
  assert.equal(build(values).ignored,1);assert.equal(build(values).items.length,0);
});
test('base Saúde conserva as cinco UOs, os 1502 IDs e pareceres sem inferir aprovação ou exercício', () => {
  const seed=JSON.parse(readFileSync(new URL('./seed.health.json',import.meta.url),'utf8'));
  const items=createHealthBudgetItems(seed);
  assert.equal(items.length,1502);assert.equal(new Set(items.map(i=>i.id)).size,1502);
  assert.deepEqual(items.reduce((all,item)=>(all[item.codigoUnidadeOrcamentaria]=(all[item.codigoUnidadeOrcamentaria]||0)+1,all),{}),{'4291':342,'2261':296,'2271':465,'1541':73,'2321':326});
  for(let index=0;index<items.length;index++){const item=items[index],raw=seed.obzItems[index];assert.equal(item.exercise,null);assert.equal(item.cotaAprovada,undefined);assert.equal(item.source.unitLabel,raw.uo);assert.equal(item.deliberacaoCofinOriginal,raw.deliberacaoCofin);assert.equal(item.valorTotal,raw.valorTotal);}
  assert.equal(items[0].id,'obz-fes-ses-4145-0');
});
test('migração corrige somente a UO produzida pelo adaptador antigo e preserva o rascunho', () => {
  const baseline=initial(), source=build().items[0];
  source.id='seed';source.source.kind='seed-saude';source.unidadeOrcamentaria='02261 - FUNED';source.codigoUnidadeOrcamentaria='2261';
  baseline.budgetItems=[source];
  const state=initial();state.planning.obzDataVersion=undefined;
  const old={...source,source:undefined,unidadeOrcamentaria:'4291 - Fundo Estadual de Saúde (SES)',descricao:'Texto editado',valorTotal:17,programaId:'erro-antigo',actionId:'erro-antigo'};
  state.budgetItems=[old];
  migrateBudgetData(state,baseline);
  assert.equal(state.budgetItems[0].codigoUnidadeOrcamentaria,'2261');assert.equal(state.budgetItems[0].descricao,'Texto editado');assert.equal(state.budgetItems[0].valorTotal,17);assert.equal(state.budgetItems[0].programaId,'');
  assert.equal(state.budgetItems[0].legacyIdentity.programaId,'erro-antigo');
  const copy=JSON.stringify(state);migrateBudgetData(state,baseline);assert.equal(JSON.stringify(state),copy);
});
test('persistência evita repetir fonte do seed e restaura a proveniência íntegra', () => {
  const baseline=initial();baseline.budgetItems=build().items;
  const next=structuredClone(baseline);next.budgetItems[0].descricao='Proposta';
  const raw=encodeState(next,baseline),parsed=JSON.parse(raw);
  assert.equal(parsed.collections.budgetItems.upserts[0].source,undefined);
  const decoded=decodeState(raw,baseline);assert.deepEqual(decoded.budgetItems[0].source,baseline.budgetItems[0].source);assert.equal(decoded.budgetItems[0].descricao,'Proposta');
  parsed.collections.budgetItems.upserts.push(parsed.collections.budgetItems.upserts[0]);
  assert.throws(()=>decodeState(JSON.stringify(parsed),baseline),/duplicado/);
});
test('backup precede migração OBZ e origem protegida não aceita alterações diretas', () => {
  const baseline=initial();baseline.budgetItems=build().items;
  const old=JSON.parse(encodeState(baseline,baseline));delete old.values.planning.obzDataVersion;
  const values=new Map([[STORAGE_KEY,JSON.stringify(old)]]),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  readPersisted(storage,baseline,baseline);assert.equal(values.get(OBZ_BACKUP_KEY),JSON.stringify(old));
  const changed=structuredClone(baseline);changed.budgetItems[0].source.unitLabel='Outra';
  assert.throws(()=>enforceBudgetUpdate(baseline,changed),/Origem/);
  const broken=structuredClone(baseline);broken.budgetItems[0].actionId='outra-uo';
  assert.throws(()=>enforceBudgetUpdate(baseline,broken),/incompatível/);
});
test('prioridade é única por exercício, programa, UO e ação, preservando unidades distintas', () => {
  const a=build().items[0];Object.assign(a,{classificacaoCenario:'INCREMENTAL',prioridadeN3:1,prioridadeN2:1,prioridadeN1:1});
  const b=structuredClone(a);b.id='outro';b.codigoUnidadeOrcamentaria='2461';b.unidadeOrcamentaria='02461 - ARMVA';
  assert.equal(budgetPriorityIssues([a,b]).length,0);
  b.codigoUnidadeOrcamentaria='1221';assert.equal(budgetPriorityIssues([a,b]).length,3);
});

test('gerador de Saúde lê a planilha real e registra linha e células sem sobrescrever o seed ativo',()=>{
 const temp=mkdtempSync(join(tmpdir(),'fpo-seed-'));
 try {
   const output=join(temp,'seed.json');
   const child=spawnSync(process.execPath,['scripts/build-health-seed.cjs'],{env:{...process.env,FPO_SEED_OUTPUT:output},encoding:'utf8'});
   assert.equal(child.status,0,child.stderr);
   const generated=JSON.parse(readFileSync(output,'utf8'));
   assert.equal(generated.obzItems.length,1502);
   assert.equal(new Set(generated.obzItems.map(item=>item.uo)).size,5);
   assert.ok(generated.obzItems.every(item=>item.sourceRow>=3&&Array.isArray(item.rawRow)&&Array.isArray(item.sourceHeaders)));
   const keys=generated.healthActions.map(action=>JSON.stringify([action.programaCodigo,unitCode(action.codigoUnidadeAcao),action.acaoCodigo]));
   assert.equal(new Set(keys).size,keys.length);
   const items=createHealthBudgetItems(generated);
   assert.equal(items.length,1502);assert.ok(items.every(item=>item.source.row>=3));
   const header=generated.obzItems[0].sourceHeaders,index=header.indexOf('FREQUÊNCIA PAGAMENTO');
   for(const item of generated.obzItems)if(item.rawRow[index]==='')assert.equal(item.frequencia,null);
 }finally{rmSync(temp,{recursive:true,force:true});}
});

test('aprovação possivelmente inferida na versão anterior exige conferência sem apagar a decisão',()=>{
 const baseline=initial();const item=build().items[0];item.source.kind='seed-saude';baseline.budgetItems=[item];
 const next=structuredClone(baseline);delete next.planning.obzDataVersion;next.budgetItems[0].cotaAprovada=true;
 migrateBudgetData(next,baseline);assert.equal(next.budgetItems[0].cotaAprovada,true);assert.equal(next.budgetItems[0].validationNeedsReview,true);
 const validated=structuredClone(baseline);delete validated.planning.obzDataVersion;validated.budgetItems[0].cotaAprovada=true;validated.budgetItems[0].statusValidacao='VALIDADO DCMEFO/SEPLAG';
 migrateBudgetData(validated,baseline);assert.equal(validated.budgetItems[0].validationNeedsReview,undefined);
});
