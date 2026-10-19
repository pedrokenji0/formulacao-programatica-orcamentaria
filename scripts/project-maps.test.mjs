import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectMapReferences, originalProjectMap } from '../src/services/projectMapReference.ts';
import { canEditProjectMap, enforceProjectMapUpdate, projectMapForAction, projectMapsForProgram, projectMapDifferences, restoreProjectMap, restoreProjectRecord, removeProjectRecord } from '../src/services/projectMapDomain.ts';
import { encodeState, decodeState } from '../src/services/planningPersistence.ts';
import { enforceEditingUpdate } from '../src/services/proposalEditing.ts';

const program = { id: 'programa-125', codigo: '0125', nome: 'Programa amplo', codigoUnidadeOrcamentaria: '01221', objetivo: 'Objetivo original', source: { origin: 'PPO', file: 'programas' } };
const actions = [
  { id: 'sede', codigo: '1082', codigoUnidadeOrcamentaria: '01221', programaId: program.id, codigoProjetoEstrategico: '14' },
  { id: 'armva', codigo: '4528', codigoUnidadeOrcamentaria: '02461', programaId: program.id, codigoProjetoEstrategico: '14' },
  { id: 'outra-frente', codigo: '4549', codigoUnidadeOrcamentaria: '04671', programaId: program.id, codigoProjetoEstrategico: '' },
];
const reference = { manifest: { datasetId: 'teste', exercise: '2026' }, programs: [program], actions, indicators: [], localizers: [] };
function initial() {
  return structuredClone({ schemaVersion: 2, perfil: 'Gestor Setorial', unidade: '01221 - SEDE', currentProgramId: program.id, programs: [program], actions,
    maps: [{ programId: program.id, problemaCentral: 'Conteúdo anterior a preservar', actions: [], contexto: [], resultados: [], impactos: [] }],
    projectMaps: createProjectMapReferences(actions), frameworks: [], budgetItems: [], links: [], mirrors: [], support: {}, lists: {},
    planning: { datasetId: 'teste', exercise: '2026', indicatorProposals: {}, localIndicators: [], localizerProposals: {}, justifications: {}, migrationNotices: [], review: {}, history: [], associationRequests: [] },
  });
}

test('carrega as duas figuras no mesmo mapa sem inventar fichas técnicas ou vínculos confirmados', () => {
  const state = initial(), map = state.projectMaps[0];
  assert.equal(map.components.length, 37);
  assert.equal(map.indicators.length, 12);
  assert.deepEqual(Object.fromEntries(['contexto','recurso','atividade','produto','resultado','impacto','pressuposto'].map((kind) => [kind, map.components.filter((item) => item.kind === kind).length])), { contexto:5, recurso:8, atividade:5, produto:4, resultado:7, impacto:6, pressuposto:2 });
  assert.ok(map.components.every((item) => item.actionIds.length === 0 && item.source.figure === '2' && item.source.year === 2025));
  assert.ok(map.indicators.every((item) => !item.formula && !item.unit && !item.officialCode && !item.referenceIndex && item.source.figure === '3'));
  assert.ok(map.indicators.flatMap((item) => item.links).every((link) => link.status === 'sugerido'));
  assert.ok(map.relations.every((link) => map.components.some((item) => item.id === link.fromId) && map.components.some((item) => item.id === link.toId)));
  assert.equal(projectMapDifferences(map).length, 0);
});

test('as ações Sede e ARMVA resolvem o mesmo mapa; outras ações não são incluídas', () => {
  const state = initial();
  assert.equal(projectMapForAction(state, 'sede'), projectMapForAction(state, 'armva'));
  assert.equal(projectMapForAction(state, 'outra-frente'), undefined);
  assert.deepEqual(state.projectMaps[0].actionIds, ['sede', 'armva']);
  const map = state.projectMaps[0];
  map.components[0].text = 'Uma edição compartilhada';
  assert.equal(projectMapForAction(state, 'armva').components[0].text, 'Uma edição compartilhada');
  const extra = { ...actions[1], id: 'acao-outro-programa', programaId: 'outro-programa' };
  state.actions.push(extra); map.actionIds.push(extra.id);
  assert.equal(projectMapsForProgram(state, 'outro-programa')[0].id, map.id);
  assert.equal(state.projectMaps.length, 1);
});

test('editar e reverter respeitam perfil e UO e mantêm o original protegido', () => {
  for (const perfil of ['Leitor', 'Consulta', 'DCMEFO/SEPLAG']) {
    const state = initial(); state.perfil = perfil;
    assert.equal(canEditProjectMap(state, state.projectMaps[0]), false);
    assert.throws(() => restoreProjectMap(state, state.projectMaps[0].id, 'mapr'), /consulta/);
    const next = structuredClone(state); next.projectMaps[0].components[0].text = 'Tentativa';
    assert.throws(() => enforceEditingUpdate(state, next, reference), /permissão/);
  }
  const state = initial(); state.perfil = 'Gestor UA';
  assert.equal(canEditProjectMap(state, state.projectMaps[0]), true);
  state.unidade = '02461 - ARMVA';
  assert.equal(canEditProjectMap(state, state.projectMaps[0]), false);
  const next = initial(); next.projectMaps[0].components[0].source.pdfPage = 99;
  assert.throws(() => enforceProjectMapUpdate(initial(), next), /protegida/);
  const duplicate = initial(); duplicate.projectMaps.push({ ...structuredClone(duplicate.projectMaps[0]), id: 'outra-copia' });
  assert.throws(() => enforceProjectMapUpdate(initial(), duplicate), /único mapa/);
});

test('reversão do MaPR preserva indicadores e cadastros; reversão de indicador preserva MaPR', () => {
  const before = initial(), state = initial(), id = state.projectMaps[0].id;
  state.projectMaps[0].components[0].text = 'Texto proposto';
  state.projectMaps[0].indicators[0].name = 'Indicador reformulado';
  const ref = originalProjectMap(state.projectMaps[0]);
  assert.notEqual(ref.components[0].text, state.projectMaps[0].components[0].text);
  enforceEditingUpdate(before, state, reference);
  assert.equal(state.planning.review[program.id].status, 'pendente');
  restoreProjectMap(state, id, 'mapr');
  assert.deepEqual(state.projectMaps[0].components, before.projectMaps[0].components);
  assert.equal(state.projectMaps[0].indicators[0].name, 'Indicador reformulado');
  assert.deepEqual(state.maps, before.maps);
  assert.deepEqual(state.programs, before.programs);
  assert.equal(state.perfil, before.perfil);
  restoreProjectRecord(state, id, 'indicador', state.projectMaps[0].indicators[0].id);
  assert.deepEqual(state.projectMaps[0], before.projectMaps[0]);
  assert.equal(state.planning.history.filter((event) => event.operation === 'reversao').length, 2);
  enforceEditingUpdate(before, state, reference);
});

test('propostas persistem; estados v2 antigos recebem o mapa sem apagar a edição anterior', () => {
  const baseline = initial(), next = initial();
  next.projectMaps[0].components[0].text = 'Texto persistido';
  next.projectMaps[0].indicators[0].formula = 'Fórmula informada pela equipe';
  next.maps[0].problemaCentral = 'Edição anterior no mapa de programa';
  const restored = decodeState(encodeState(next, baseline), baseline);
  assert.deepEqual(restored.projectMaps, next.projectMaps);
  assert.deepEqual(restored.maps, next.maps);
  const oldPackage = JSON.parse(encodeState(next, baseline)); delete oldPackage.collections.projectMaps;
  const migrated = decodeState(JSON.stringify(oldPackage), baseline);
  assert.equal(migrated.projectMaps.length, 1);
  assert.equal(migrated.projectMaps[0].components.length, 37);
  assert.equal(migrated.maps[0].problemaCentral, 'Edição anterior no mapa de programa');
  const again = decodeState(encodeState(migrated, baseline), baseline);
  assert.equal(again.projectMaps.length, 1);
});

test('confirmar vínculo é explícito e remover componente não apaga a associação nem a ficha', () => {
  const before = initial(), state = initial(), map = state.projectMaps[0];
  const indicator = map.indicators.find((item) => item.links.length);
  const link = indicator.links[0]; link.status = 'confirmado';
  enforceEditingUpdate(before, state, reference);
  const previous = structuredClone(state);
  removeProjectRecord(state, map.id, 'componente', link.componentId);
  enforceEditingUpdate(previous, state, reference);
  assert.ok(indicator.links.some((item) => item.componentId === link.componentId && item.status === 'confirmado'));
  assert.equal(map.indicators.length, 12);
  restoreProjectRecord(state, map.id, 'componente', link.componentId);
  assert.ok(map.components.some((item) => item.id === link.componentId));
});
