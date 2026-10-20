import test from 'node:test';
import assert from 'node:assert/strict';
import { auditPlanningData } from '../src/services/dataIntegrity.ts';
import { migrateBudgetData } from '../src/services/obzData.ts';
const state=()=>({programs:[{id:'p',codigo:'125'}],actions:[{id:'a',codigo:'1082',programaId:'p',codigoUnidadeOrcamentaria:'1221'}],projectMaps:[],budgetItems:[],links:[],planning:{exercise:'2026',migrationNotices:[]}});
test('relações opcionais OBZ não são tratadas como erro de planejamento',()=>{
 const next=state();next.budgetItems=[{id:'i',descricao:'Item',programaId:'',actionId:'',unidadeOrcamentaria:'UO não identificada',exercise:null,totalMode:'ausente',valorTotal:0,linkage:{status:'pendente',issues:[],candidates:[]}}];
 const findings=auditPlanningData(next);assert.equal(findings.filter(x=>x.level==='erro').length,0);assert.ok(findings.some(x=>x.code==='obz-pendente'));assert.ok(findings.some(x=>x.code==='obz-sem-total'));
});
test('identificadores duplicados e vínculos confirmados incompatíveis são apontados',()=>{
 const next=state();next.actions.push({...next.actions[0]});next.budgetItems=[{id:'i',descricao:'Item',programaId:'p',actionId:'a',programaCodigo:'125',acaoLabel:'1082 - Ação',unidadeOrcamentaria:'2461 - ARMVA',exercise:'2026',valorTotal:0,linkage:{status:'vinculado',issues:[],candidates:[]}}];
 const findings=auditPlanningData(next);assert.ok(findings.some(x=>x.code==='id-duplicado'));assert.ok(findings.some(x=>x.code==='obz-vinculo-incompativel'));
});
test('remoção de componente mantém aviso de indicador sem fabricar outro vínculo',()=>{
 const next=state();next.projectMaps=[{id:'m',projectId:'j',ownerProgramId:'p',actionIds:['a'],components:[],indicators:[{id:'ind',name:'Indicador',links:[{componentId:'removido',status:'confirmado'}]}]}];
 const findings=auditPlanningData(next);assert.ok(findings.some(x=>x.code==='indicador-sem-componente'));assert.equal(next.projectMaps[0].indicators[0].links[0].componentId,'removido');
});
test('migração preserva a associação antiga, marcando a incoerência até conferência',()=>{
 const next=state();next.budgetItems=[{id:'i',programaId:'p',actionId:'a',acaoLabel:'1082 - Ação',unidadeOrcamentaria:'1221 - SEDE',valorTotal:0}];next.links=[{id:'l',budgetItemId:'i',actionId:'a',status:'Completo',warnings:[],resourceIds:['recurso-antigo']}];
 const migrated=migrateBudgetData(next,structuredClone(next));assert.equal(migrated.links[0].status,'Inconsistente');assert.deepEqual(migrated.links[0].resourceIds,['recurso-antigo']);assert.ok(migrated.links[0].warnings.length);assert.equal(migrated.budgetItems[0].actionId,'');
});
