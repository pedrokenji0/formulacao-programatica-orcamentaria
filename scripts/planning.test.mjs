import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildPlanning, readSources, parsePipe, normalizeCode, actionId, flag } from './planning-import.mjs';
import { createPlanningInitial, setOfficialField, mapComponents, indicatorsFor } from '../src/services/planningDomain.ts';
import { encodeState, decodeState, readPersisted, migrateLegacy, STORAGE_KEY, LEGACY_KEY } from '../src/services/planningPersistence.ts';
import { addActionItem, editorItems, canAddActionItem, principalProduct, secondaryProducts, setActionLink, removeActionItem } from '../src/services/mapDomain.ts';
import { draftProgram, draftAction, draftLocalizer, applyProgramFields, applyActionFields, catalogOptions, programPending, actionPending, causeItems, restoreProgram, restoreAction } from '../src/services/proposalDomain.ts';
import { changeSituation, discardDraft, editIndicator, enforceEditingUpdate, proposeAssociation } from '../src/services/proposalEditing.ts';
import { fieldRule, exclusionRequirement, indicatorPending, canEditRecord, knownProgramUnit } from '../src/services/editingPolicy.ts';

const sources = readSources(fileURLToPath(new URL('../data/raw/plan2026/', import.meta.url)));
const data = buildPlanning(sources, '2026');
const legacy = {
  perfil: 'Técnico do Órgão', unidade: '', currentProgramId: '', programs: [], actions: [], maps: [], frameworks: [], budgetItems: [], links: [], mirrors: [],
  support: { programmatic: [], budgetary: [] },
  lists: { unidades: [], programas: [], acoes: [], grupos: [], elementos: [], elementosItens: [], agrupamentos: [], fontes: [], funcoes: [], subfuncoes: [], tiposAcao: [], publicos: [], categoriasRecurso: [], categoriasAtividade: [], categoriasProduto: [], periodicidades: [], unidadesMedida: [], polaridades: [] },
};
const initial = createPlanningInitial(legacy, data);

test('lê todas as bases em Windows-1252, preservando cabeçalhos oficiais e textos', () => {
  assert.equal(sources.programas.rows.length, 2553);
  assert.equal(sources.acoes.rows.length, 1046);
  assert.equal(sources.indicadores.rows.length, 237);
  assert.equal(sources.localizadores.rows.length, 44507);
  assert.ok(sources.programas.headers.includes('Causas'));
  assert.ok(data.programs[0].nome.includes('ÍNTEGRA'));
  assert.ok(!JSON.stringify(data.programs).includes('\uFFFD'));
  const parsed = parsePipe('Código do Programa|Texto|Vazio\r\n0001|"Primeira linha\nSegunda ""citada"" | com barra"|\r\n');
  assert.equal(parsed.rows[0].Texto, 'Primeira linha\nSegunda "citada" | com barra');
  assert.equal(parsed.rows[0].Vazio, '');
  assert.throws(() => parsePipe('Código do Programa|Texto\n001|a|b'));
});

test('consolida programas sem perder combinações de objetivo, diretriz e ODS', () => {
  assert.equal(data.programs.length, 182);
  assert.equal(new Set(data.programs.map((program) => normalizeCode(program.codigo))).size, 182);
  for (const program of data.programs) {
    const rows = sources.programas.rows.filter((row) => normalizeCode(row['Código do Programa']) === normalizeCode(program.codigo));
    const keys = Object.keys(program.strategicLinks[0]);
    const expected = new Set(rows.map((row) => JSON.stringify(Object.fromEntries(keys.map((key) => [key, row[key]])))));
    assert.deepEqual(new Set(program.strategicLinks.map((link) => JSON.stringify(link))), expected);
    assert.equal(program.officialFields.Causas, rows[0].Causas);
    assert.equal(program.officialFields.Objetivo, rows[0].Objetivo);
  }
});

test('identifica ações por programa, UO e ação e preserva todas as variantes', () => {
  assert.equal(data.actions.length, 1044);
  assert.equal(new Set(data.actions.map((action) => action.id)).size, data.actions.length);
  assert.ok(data.actions.every((action) => action.orgao === ''));
  assert.equal(data.actions.reduce((total, action) => total + action.sourceVariants.length, 0), 1046);
  for (const row of sources.acoes.rows) {
    const id = actionId(row['Código do Programa'], row['Código da Unidade Orçamentária Responsável pela Ação'], row['Código da Ação']);
    const action = data.actions.find((record) => record.id === id);
    assert.ok(action);
    assert.equal(action.codigoUnidadeOrcamentaria, row['Código da Unidade Orçamentária Responsável pela Ação']);
  }
  assert.notEqual(actionId('0125', '01221', '1082'), actionId('0125', '02461', '1082'));
  assert.equal(actionId('0125', '01221', '1082'), actionId('125', '1221', '01082'));
});

test('demonstra Minas Reurb sem atribuir todo o programa 125 ao projeto 14', () => {
  const program = data.programs.find((record) => normalizeCode(record.codigo) === '125');
  const actions = data.actions.filter((record) => record.programaId === program.id);
  const reurb = actions.filter((record) => normalizeCode(record.officialFields['Código do Projeto Estratégico']) === '14');
  const sede = reurb.find((record) => normalizeCode(record.codigo) === '1082' && normalizeCode(record.codigoUnidadeOrcamentaria) === '1221');
  const armva = reurb.find((record) => normalizeCode(record.codigo) === '4528' && normalizeCode(record.codigoUnidadeOrcamentaria) === '2461');
  assert.ok(sede); assert.ok(armva);
  assert.notEqual(sede.especificacaoProduto, armva.especificacaoProduto);
  assert.ok(actions.length > reurb.length);
  assert.equal(data.indicators.filter((record) => record.programId === program.id).length, 0);
});

test('importa indicadores sem metas futuras e sem associação automática ao mapa', () => {
  assert.equal(data.indicators.length, 237);
  for (const indicator of data.indicators) {
    assert.ok(data.programs.some((program) => program.id === indicator.programId));
    assert.equal(indicator.component, null);
    const source = sources.indicadores.rows.find((row) => row.Indicador === indicator.fields.Indicador && normalizeCode(row['Código do Programa']) === normalizeCode(indicator.fields['Código do Programa']));
    assert.equal(indicator.fields['Índice de Referência'], source['Índice de Referência']);
    assert.equal(indicator.fields['Data de Apuração'], source['Data de Apuração']);
  }
  const programWithIndicators = data.programs.find((program) => normalizeCode(program.codigo) === '1');
  assert.ok(indicatorsFor(initial, data, programWithIndicators.id).length > 0);
  const forbidden = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!/^Previsão /i.test(key), key);
      assert.ok(!/^Em apuração\? \(20\d\d\)/.test(key), key);
      forbidden(child);
    }
  };
  forbidden({ programs: data.programs, actions: data.actions, indicators: data.indicators, localizers: data.localizers });
  assert.throws(() => buildPlanning(sources, undefined), /exercício/);
});

test('preserva todos os localizadores, códigos textuais, vínculos e relações territoriais', () => {
  assert.equal(data.localizers.length, 44507);
  assert.equal(data.localizers.reduce((total, record) => total + record.territories.length, 0), sources.localizadores.rows.length);
  assert.ok(data.localizers.some((record) => record.fields['Código do Localizador'] === 'X94661'));
  const actionIndex = new Map(data.actions.map((action) => [action.id, action]));
  for (const localizer of data.localizers) {
    assert.ok(actionIndex.has(localizer.actionId));
    const action = actionIndex.get(localizer.actionId);
    assert.equal(normalizeCode(action.codigoUnidadeOrcamentaria), normalizeCode(localizer.fields['Código da Unidade Orçamentária Responsável pela Ação']));
    for (const territory of localizer.territories) {
      assert.ok(Object.hasOwn(territory.fields, 'Código do Município IBGE'));
      assert.ok(Object.hasOwn(territory.fields, 'Código do Município Sigplan'));
    }
  }
  assert.equal(flag('True'), true); assert.equal(flag('Sim'), true); assert.equal(flag('False'), false); assert.equal(flag('Não'), false); assert.equal(flag(''), null);
});

test('preserva relações diferentes de um mesmo localizador sem cruzamentos e informa vínculo ausente', () => {
  const small = structuredClone(sources);
  small.localizadores.rows = [structuredClone(sources.localizadores.rows[0]), structuredClone(sources.localizadores.rows[0]), structuredClone(sources.localizadores.rows[0])];
  small.localizadores.rows[1].Município = 'REFERÊNCIA ESPECIAL';
  small.localizadores.rows[1]['Código do Município IBGE'] = '';
  small.localizadores.rows[1]['Região Geográfica Intermediária'] = '';
  small.localizadores.rows[1]['Exclusão Lógica do Localizador'] = 'Sim';
  small.localizadores.rows[0]['Exclusão Lógica da Ação'] = 'True';
  small.localizadores.rows[2]['Código da Unidade Orçamentária Responsável pela Ação'] = '99999';
  const result = buildPlanning(small, '2026');
  assert.equal(result.localizers.length, 2);
  assert.equal(result.localizers[0].territories.length, 2);
  assert.equal(result.localizers[0].territories[1].fields.Município, 'REFERÊNCIA ESPECIAL');
  assert.equal(result.localizers[0].territories[1].fields['Região Geográfica Intermediária'], '');
  assert.equal(flag(result.localizers[0].territories[0].statusFields['Exclusão Lógica da Ação']), true);
  assert.equal(flag(result.localizers[0].territories[0].statusFields['Exclusão Lógica do Localizador']), false);
  assert.equal(result.localizers[1].actionId, null);
  assert.ok(result.issues.some((issue) => issue.message.includes('Vínculo não encontrado')));
});

test('variantes de indicador com o mesmo nome mantêm IDs estáveis e todas as informações', () => {
  const small = { ...sources, localizadores: { ...sources.localizadores, rows: [] }, indicadores: { ...sources.indicadores, rows: [sources.indicadores.rows[0], { ...sources.indicadores.rows[0], Fonte: 'Outra fonte registrada' }] } };
  const normal = buildPlanning(small, '2026');
  const reversed = buildPlanning({ ...small, indicadores: { ...small.indicadores, rows: [...small.indicadores.rows].reverse() } }, '2026');
  assert.equal(normal.indicators.length, 2);
  assert.equal(new Set(normal.indicators.map((record) => record.id)).size, 2);
  assert.deepEqual(new Set(normal.indicators.map((record) => record.id)), new Set(reversed.indicators.map((record) => record.id)));
});

test('mantém identidades estáveis ao reordenar linhas', () => {
  const reversed = Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, { ...source, rows: [...source.rows].reverse() }]));
  const result = buildPlanning(reversed, '2026');
  for (const key of ['programs', 'actions', 'indicators', 'localizers']) assert.deepEqual(new Set(result[key].map((record) => record.id)), new Set(data[key].map((record) => record.id)));
});

test('persiste proposta por diferenças, restaura edição e mantém referência intacta', () => {
  const proposal = structuredClone(initial);
  const referenceProgram = data.programs.find((program) => program.id === proposal.currentProgramId);
  const program = proposal.programs.find((record) => record.id === proposal.currentProgramId);
  setOfficialField(program, 'Objetivo', 'Situação proposta para validação');
  proposal.planning.justifications[program.id] = 'Justificativa de teste';
  const localizer = structuredClone(data.localizers[0]);
  localizer.territories[0].fields.Município = 'Proposta territorial';
  proposal.planning.localizerProposals[localizer.id] = localizer;
  const indicator = structuredClone(data.indicators[0]);
  indicator.fields.Fonte = 'Nova fonte local';
  proposal.planning.indicatorProposals[indicator.id] = indicator;
  const encoded = encodeState(proposal, initial);
  assert.ok(encoded.length < 200000);
  const restored = decodeState(encoded, initial);
  assert.equal(restored.programs.find((record) => record.id === program.id).objetivo, 'Situação proposta para validação');
  assert.equal(restored.planning.justifications[program.id], 'Justificativa de teste');
  assert.equal(restored.planning.localizerProposals[localizer.id].territories[0].fields.Município, 'Proposta territorial');
  assert.equal(restored.planning.indicatorProposals[indicator.id].fields.Fonte, 'Nova fonte local');
  assert.notEqual(referenceProgram.objetivo, 'Situação proposta para validação');
});

test('migra estado anterior preservando texto local, OBZ e cópia v1', () => {
  const program = structuredClone(initial.programs[0]);
  const previousBaseline = { ...structuredClone(legacy), programs: [{ ...program, id: 'legacy-program' }], currentProgramId: 'legacy-program' };
  const previous = structuredClone(previousBaseline);
  previous.programs[0].objetivo = 'Edição anterior';
  previous.budgetItems = [{ id: 'legacy-obz', programaId: 'legacy-program', actionId: 'legacy-action', descricao: 'Item legado preservado' }];
  const store = new Map([[LEGACY_KEY, JSON.stringify(previous)]]);
  const storage = { getItem: (key) => store.get(key) || null, setItem: (key, value) => store.set(key, value) };
  const migrated = readPersisted(storage, initial, previousBaseline);
  assert.equal(migrated.programs.find((record) => record.id === program.id).officialFields.Objetivo, 'Edição anterior');
  assert.equal(migrated.budgetItems[0].descricao, 'Item legado preservado');
  assert.ok(store.has(LEGACY_KEY));
  storage.setItem(STORAGE_KEY, '{conteúdo incompatível');
  const recovered = readPersisted(storage, initial, previousBaseline);
  assert.ok([...store.keys()].some((key) => key.startsWith(`${STORAGE_KEY}-backup-`)));
  assert.ok(recovered.planning.migrationNotices.length);
  assert.throws(() => migrateLegacy({}, initial, legacy));
});

test('não transforma objetivo ou finalidade em resultados confirmados', () => {
  assert.ok(initial.maps.every((map) => map.resultados.length === 0 && map.impactos.length === 0));
  assert.ok(initial.maps.every((map) => map.actions.every((action) => action.objetivo === '')));
  const mappedProduct = initial.maps.flatMap((map) => map.actions.flatMap((action) => action.produtos))[0];
  assert.equal(mappedProduct.origin, 'importado');
  assert.ok(mapComponents(initial.maps[0]).every((component) => component.association.kind !== 'resultado'));
});

test('artefato compactado é reproduzível e corresponde às fontes atuais', () => {
  const generated = JSON.parse(gunzipSync(readFileSync(new URL('../public/data/planning.json.gz', import.meta.url))));
  assert.equal(generated.manifest.datasetId, data.manifest.datasetId);
  assert.deepEqual(generated.programs, data.programs);
  assert.deepEqual(generated.actions, data.actions);
  assert.deepEqual(generated.indicators, data.indicators);
  assert.equal(generated.localizers.length, data.localizers.length);
});

test('limita cada grupo da ação a 8 linhas sem truncar estados anteriores', () => {
  const action = structuredClone(initial.maps[0].actions[0]);
  for (const section of ['recursos', 'atividades', 'resultados', 'impactos']) {
    for (let index = 0; index < 8; index++) assert.equal(addActionItem(action, section, { id: `${section}-${index}`, texto: `Linha ${index + 1}`, origin: 'local' }), true);
    assert.equal(addActionItem(action, section, { id: 'excedente', texto: 'Não adicionar' }), false);
    assert.equal(editorItems(action, section).length, 8);
  }
  action.recursos.push({ id: 'legado', texto: 'Nona linha antiga preservada' });
  assert.equal(canAddActionItem(action, 'recursos'), false);
  assert.equal(action.recursos.length, 9);
});

test('separa produto principal e secundários preservando IDs e a origem PPO', () => {
  const map = structuredClone(initial.maps[0]);
  const action = map.actions.find((record) => record.produtos.length);
  const importedId = action.produtos[0].id;
  assert.equal(principalProduct(action).id, importedId);
  assert.equal(addActionItem(action, 'produtoPrincipal', { id: 'outro-principal', texto: 'Não adicionar' }), false);
  for (let index = 0; index < 7; index++) assert.equal(addActionItem(action, 'produtosSecundarios', { id: `secundario-${index}`, texto: `Entrega ${index + 1}` }), true);
  assert.equal(secondaryProducts(action).length, 7);
  assert.equal(action.produtos.length, 8);
  assert.equal(action.produtos[0].origin, 'importado');
  assert.equal(addActionItem(action, 'produtosSecundarios', { id: 'excedente', texto: 'Não adicionar' }), false);
  removeActionItem(map, action.id, 'produtos', importedId);
  assert.equal(principalProduct(action), undefined);
  assert.equal(secondaryProducts(action).length, 7);
  assert.equal(addActionItem(action, 'produtoPrincipal', { id: 'novo-principal', texto: 'Entrega principal local' }), true);
  assert.equal(principalProduct(action).id, 'novo-principal');
});

test('vínculos múltiplos respeitam a ação/UO e remoções limpam as relações do mapa', () => {
  const map = structuredClone(initial.maps.find((record) => record.programId === 'ppo-programa-125') || initial.maps[0]);
  const action = map.actions[0];
  const other = map.actions[1];
  action.recursos = [{ id: 'recurso', texto: 'Equipe' }];
  action.atividades = [{ id: 'atividade-1', texto: 'Analisar' }, { id: 'atividade-2', texto: 'Entregar' }];
  other.atividades = [{ id: 'outra-atividade', texto: 'Atividade de outra UO' }];
  assert.equal(setActionLink(action, 'recursos', 'recurso', 'outra-atividade', true), false);
  assert.equal(setActionLink(action, 'recursos', 'recurso', 'atividade-1', true), true);
  setActionLink(action, 'recursos', 'recurso', 'atividade-2', true);
  setActionLink(action, 'recursos', 'recurso', 'atividade-2', true);
  assert.equal(action.recursos[0].associations.length, 2);
  const product = action.produtos[0] || { id: 'produto-local', texto: 'Entrega' };
  action.produtos = [product];
  setActionLink(action, 'atividades', 'atividade-1', product.id, true);
  assert.equal(action.atividades[0].associations[0].kind, 'produto');
  map.causas = [{ id: 'causa', texto: 'Causa local', associations: [{ kind: 'atividade', actionId: action.id, componentId: 'atividade-1' }] }];
  removeActionItem(map, action.id, 'atividades', 'atividade-1');
  assert.equal(action.recursos[0].associations.length, 1);
  assert.equal(action.recursos[0].associations[0].componentId, 'atividade-2');
  assert.equal(map.causas[0].associations.length, 0);
  removeActionItem(map, action.id, 'produtos', product.id);
  assert.equal(action.produtos.length, 0);
});

test('resultados por ação coexistem com os do programa e persistem com vínculos estáveis', () => {
  const proposal = structuredClone(initial);
  const map = proposal.maps[0];
  const action = map.actions[0];
  map.resultados.push({ id: 'resultado-programa', texto: 'Resultado compartilhado anterior' });
  addActionItem(action, 'resultados', { id: 'resultado-acao', texto: 'Resultado específico da ação' });
  addActionItem(action, 'impactos', { id: 'impacto-acao', texto: 'Impacto específico da ação' });
  addActionItem(action, 'recursos', { id: 'recurso', texto: 'Equipe' });
  addActionItem(action, 'atividades', { id: 'atividade', texto: 'Execução' });
  setActionLink(action, 'recursos', 'recurso', 'atividade', true);
  const restored = decodeState(encodeState(proposal, initial), initial).maps[0];
  assert.equal(restored.actions[0].recursos[0].associations[0].actionId, action.id);
  assert.equal(restored.actions[0].resultados[0].texto, 'Resultado específico da ação');
  const components = mapComponents(restored);
  assert.ok(components.some((component) => component.value === `resultado|${action.id}|resultado-acao`));
  assert.ok(components.some((component) => component.value === 'resultado||resultado-programa'));
  assert.ok(!restored.actions[1]?.resultados?.length);
});

test('rascunhos incompletos persistem sem códigos ou situações oficiais fabricados', () => {
  const proposal = structuredClone(initial);
  const programId = draftProgram(proposal);
  const actionId = draftAction(proposal, programId);
  const program = proposal.programs.find((record) => record.id === programId);
  const action = proposal.actions.find((record) => record.id === actionId);
  assert.equal(program.codigo, ''); assert.equal(program.nome, '');
  assert.equal(action.codigo, ''); assert.equal(action.nome, '');
  assert.equal(program.source.origin, 'local'); assert.equal(action.source.origin, 'local');
  assert.equal(program.officialFields['Programa Novo'], undefined);
  assert.equal(action.officialFields['Nova Ação'], undefined);
  assert.equal(proposal.maps.some((map) => map.programId === programId), false);
  assert.ok(programPending(program).length); assert.ok(actionPending(action).length);
  const restored = decodeState(encodeState(proposal, initial), initial);
  assert.equal(restored.currentProgramId, programId);
  assert.equal(restored.actions.find((record) => record.id === actionId).programaId, programId);
  assert.equal(restored.programs.find((record) => record.id === programId).codigo, '');
});

test('códigos, títulos e UO posteriores não alteram IDs, relações de mapa, indicadores ou localizadores', () => {
  const proposal = structuredClone(initial);
  const programId = draftProgram(proposal);
  const actionId = draftAction(proposal, programId);
  const action = proposal.actions.find((record) => record.id === actionId);
  draftLocalizer(proposal, action);
  const localizer = Object.values(proposal.planning.localizerProposals)[0];
  proposal.planning.localIndicators.push({ id: 'indicador-de-teste', origin: 'local', programId, component: { kind: 'atividade', actionId, componentId: 'atividade-teste' }, fields: {} });
  proposal.maps.push({ programId, problemaCentral: '', contexto: [], resultados: [], impactos: [], status: 'RASCUNHO', actions: [{ id: actionId, catalogActionId: actionId, codigo: '', nome: '', objetivo: '', publicoAlvo: '', recursos: [{ id: 'recurso-teste', texto: 'Equipe' }], atividades: [{ id: 'atividade-teste', texto: 'Execução' }], produtos: [], riscos: [], pressupostos: [] }] });
  const mapped = proposal.maps.at(-1).actions[0];
  setActionLink(mapped, 'recursos', 'recurso-teste', 'atividade-teste', true);
  applyProgramFields(proposal, programId, { 'Código do Programa': '00999', 'Nome do Programa': 'Programa em elaboração' });
  const unit = data.actions.find((record) => record.id === 'ppo-acao-125-1221-1082').officialFields;
  const values = { 'Código da Ação': '00998', 'Título da Ação': 'Ação em elaboração', 'Código da Unidade Orçamentária Responsável pela Ação': unit['Código da Unidade Orçamentária Responsável pela Ação'], 'Unidade Orçamentária Responsável pela Ação': unit['Unidade Orçamentária Responsável pela Ação'] };
  applyActionFields(proposal, actionId, values);
  assert.equal(action.id, actionId); assert.equal(action.programaId, programId);
  assert.equal(mapped.codigo, '00998'); assert.equal(mapped.nome, 'Ação em elaboração');
  assert.equal(mapped.codigoUnidadeOrcamentaria, values['Código da Unidade Orçamentária Responsável pela Ação']);
  assert.equal(mapped.recursos[0].associations[0].actionId, actionId);
  assert.equal(localizer.actionId, actionId); assert.equal(localizer.fields['Código do Programa'], '00999');
  assert.equal(localizer.fields['Código da Ação'], '00998');
  assert.equal(localizer.fields['Código do Localizador'], '');
  assert.equal(proposal.planning.localIndicators[0].fields['Código do Programa'], '00999');
  assert.equal(proposal.planning.localIndicators[0].component.actionId, actionId);
  const restored = decodeState(encodeState(proposal, initial), initial);
  assert.equal(restored.actions.find((record) => record.id === actionId).codigo, '00998');
  assert.equal(restored.maps.at(-1).actions[0].recursos[0].associations[0].componentId, 'atividade-teste');
});

test('catálogos preservam pares código/descrição e causas só mudam por edição explícita', () => {
  const names = ['Código da Função', 'Função'];
  const choices = catalogOptions(data.actions.map((record) => record.officialFields), names);
  assert.ok(choices.length);
  assert.equal(new Set(choices.map((record) => JSON.stringify(record))).size, choices.length);
  const proposal = structuredClone(initial);
  const action = proposal.actions[0];
  const original = data.actions.find((record) => record.id === action.id);
  applyActionFields(proposal, action.id, choices.at(-1));
  assert.equal(action.officialFields[names[0]], choices.at(-1)[names[0]]);
  assert.equal(action.funcao, choices.at(-1).Função);
  assert.deepEqual(data.actions.find((record) => record.id === action.id), original);
  const program = proposal.programs[0];
  const raw = program.officialFields.Causas;
  const items = causeItems(program);
  assert.ok(items.length);
  assert.equal(program.officialFields.Causas, raw);
  assert.equal(program.causeItems, undefined);
  program.causeItems = structuredClone(items);
  program.causeItems[0].texto = 'Causa proposta';
  applyProgramFields(proposal, program.id, { Causas: program.causeItems.map((item) => item.texto).join(' / ') });
  assert.equal(data.programs[0].officialFields.Causas, raw);
  assert.equal(program.causeItems[0].id, items[0].id);
  assert.equal(program.strategicLinks.length, data.programs[0].strategicLinks.length);
});

test('reversão restaura só a ficha escolhida, preservando IDs e cadastros vinculados', () => {
  const proposal = structuredClone(initial);
  const program = proposal.programs.find((record) => normalizeCode(record.codigo) === '125');
  const action = proposal.actions.find((record) => record.id === 'ppo-acao-125-1221-1082');
  const map = proposal.maps.find((record) => record.programId === program.id);
  const mapped = map.actions.find((record) => record.id === action.id);
  mapped.recursos.push({ id: 'recurso-a-preservar', texto: 'Recurso confirmado', origin: 'confirmado' });
  const localActionId = draftAction(proposal, program.id);
  draftLocalizer(proposal, action);
  proposal.planning.localIndicators.push({ id: 'indicador-a-preservar', programId: program.id, fields: { Indicador: 'Complementar' }, origin: 'local', component: null });
  applyProgramFields(proposal, program.id, { 'Nome do Programa': 'Nome proposto a reverter', Objetivo: 'Objetivo local', Causas: 'Causa local' });
  program.ppoComplements = { Nome: 'Registro anterior' };
  program.causeItems = [{ id: 'causa-local', texto: 'Causa local' }];
  applyActionFields(proposal, action.id, { 'Título da Ação': 'Título local' });
  changeSituation(proposal, data, 'action', action.id, true, 'Reorganização proposta');
  action.detalhamentoImplementacao = 'Detalhamento local';
  assert.equal(restoreAction(proposal, data, action.id), true);
  assert.equal(proposal.actions.find((record) => record.id === action.id).nome, data.actions.find((record) => record.id === action.id).nome);
  assert.equal(proposal.actions.find((record) => record.id === action.id).detalhamentoImplementacao, data.actions.find((record) => record.id === action.id).detalhamentoImplementacao);
  assert.equal(mapped.recursos[0].id, 'recurso-a-preservar');
  assert.equal(restoreProgram(proposal, data, program.id), true);
  const restored = proposal.programs.find((record) => record.id === program.id);
  assert.equal(restored.objetivo, data.programs.find((record) => record.id === program.id).objetivo);
  assert.equal(restored.causeItems, undefined);
  assert.equal(restored.ppoComplements, undefined);
  assert.ok(proposal.actions.some((record) => record.id === localActionId));
  assert.equal(proposal.planning.localIndicators[0].id, 'indicador-a-preservar');
  assert.equal(proposal.planning.localIndicators[0].fields['Nome do Programa'], restored.nome);
  assert.equal(Object.values(proposal.planning.localizerProposals)[0].fields['Nome do Programa'], restored.nome);
  assert.equal(Object.values(proposal.planning.localizerProposals)[0].actionId, action.id);
  assert.equal(restoreAction(proposal, data, localActionId), false);
});

test('etapas livres e campos anteriores ocultos permanecem na persistência diferencial', () => {
  const proposal = structuredClone(initial);
  const action = proposal.actions[0];
  action.local = { atividades: [], criterioEntrega: '', evidenciaEntrega: '', parceirosCondicoes: '', distribuicaoTerritorial: 'Informação anterior preservada', papelLocalizador: '', criteriosTerritoriais: '', condicoesTerritoriais: '', etapasImplementacao: [{ id: 'etapa-estavel', titulo: 'Preparação', descricao: 'Articular a execução', responsaveis: 'Equipe', condicoes: '', evidencias: '' }] };
  proposal.programs[0].ppoComplements = { Nome: 'Gerente cadastrado antes da simplificação' };
  const restored = decodeState(encodeState(proposal, initial), initial);
  assert.equal(restored.actions[0].local.etapasImplementacao[0].id, 'etapa-estavel');
  assert.equal(restored.actions[0].local.distribuicaoTerritorial, 'Informação anterior preservada');
  assert.equal(restored.programs[0].ppoComplements.Nome, 'Gerente cadastrado antes da simplificação');
});

test('proposta de exclusão mantém cadastros e não propaga a situação automaticamente', () => {
  const proposal = structuredClone(initial);
  const program = proposal.programs.find((record) => normalizeCode(record.codigo) === '125');
  const actions = proposal.actions.filter((record) => record.programaId === program.id);
  const before = actions.map((record) => record.officialFields['Exclusão Lógica da Ação']);
  changeSituation(proposal, data, 'program', program.id, true, 'Reorganização proposta');
  assert.deepEqual(actions.map((record) => record.officialFields['Exclusão Lógica da Ação']), before);
  changeSituation(proposal, data, 'action', actions[0].id, true, 'Reorganização da ação');
  assert.equal(proposal.programs.length, initial.programs.length);
  assert.equal(proposal.actions.length, initial.actions.length);
  assert.deepEqual(proposal.planning.localizerProposals, {});
  assert.deepEqual(data.programs.find((record) => record.id === program.id).officialFields, initial.programs.find((record) => record.id === program.id).officialFields);
});

test('política distingue referência, proposta, rascunho e consulta sem copiar disabled do HTML', () => {
  for (const context of ['reference', 'query']) assert.equal(fieldRule('program', 'Objetivo', context).editable, false);
  assert.equal(fieldRule('program', 'Tipo de Programa', 'proposal').editable, true);
  assert.equal(fieldRule('action', 'Tipo de Ação', 'proposal').editable, false);
  assert.equal(fieldRule('action', 'Tipo de Ação', 'draft').editable, true);
  for (const field of ['PPAG', 'Exercício', 'Momento', 'Data Alteração', 'Validação oficial', 'id']) assert.equal(fieldRule('program', field, 'draft').editable, false);
  assert.equal(fieldRule('program', 'Nome do Gerente', 'proposal').editable, true);
});

test('tipo de ação importada e códigos oficiais protegidos nas funções e no limite do estado', () => {
  const proposal = structuredClone(initial);
  const action = proposal.actions[0];
  const other = data.actions.find((candidate) => candidate.tipoAcao !== action.tipoAcao);
  const types = Object.fromEntries(['Código do Tipo de Ação', 'Tipo de Ação'].map((name) => [name, other.officialFields[name]]));
  assert.throws(() => applyActionFields(proposal, action.id, types, data), /Tipo de Ação/);
  assert.throws(() => applyActionFields(proposal, action.id, { 'Código da Ação': 'inventado' }, data), /Código/);
  assert.throws(() => applyProgramFields(proposal, proposal.programs[0].id, { 'Código do Programa': 'inventado' }, data), /Código/);
  const tampered = structuredClone(initial);
  setOfficialField(tampered.actions[0], 'Tipo de Ação', other.tipoAcao);
  assert.throws(() => enforceEditingUpdate(initial, tampered, data), /Tipo de Ação/);
  const direct = structuredClone(initial);
  direct.actions[0].codigo = 'alterado fora da ficha';
  assert.throws(() => enforceEditingUpdate(initial, direct, data), /Código/);
  const draftId = draftAction(proposal, action.programaId);
  applyActionFields(proposal, draftId, types, data);
  const recovered = decodeState(encodeState(proposal, initial), initial);
  const originalType = Object.fromEntries(['Código do Tipo de Ação', 'Tipo de Ação'].map((name) => [name, action.officialFields[name]]));
  applyActionFields(recovered, draftId, originalType, data);
  assert.equal(recovered.actions.find((record) => record.id === draftId).tipoAcao, action.tipoAcao);
  assert.equal(recovered.actions.find((record) => record.id === draftId).source.origin, 'local');
});

test('classificações exigem par conhecido e especificação continua própria da ação', () => {
  const proposal = structuredClone(initial);
  const action = proposal.actions.find((record) => record.id === 'ppo-acao-125-1221-1082');
  const originalSpec = action.especificacaoProduto;
  assert.throws(() => applyActionFields(proposal, action.id, { 'Código da Função': '99' }, data), /conjuntamente/);
  assert.throws(() => applyActionFields(proposal, action.id, { 'Código da Função': '99', Função: 'Inventada' }, data), /catálogo/);
  const other = data.actions.find((record) => record.codigoProduto && record.codigoProduto !== action.codigoProduto);
  applyActionFields(proposal, action.id, { 'Código do Produto': other.codigoProduto, Produto: other.produto }, data);
  assert.equal(action.especificacaoProduto, originalSpec);
  const unit = data.programs[0];
  assert.deepEqual(knownProgramUnit(data, unit.officialFields), { 'Código do Órgão Responsável pelo Programa': unit.codigoOrgao, 'Órgão Responsável pelo Programa': unit.orgao });
  assert.deepEqual(knownProgramUnit(data, { 'Código da Unidade Orçamentária Responsável pelo Programa': '12219999' }), { 'Código do Órgão Responsável pelo Programa': '', 'Órgão Responsável pelo Programa': '' });
});

test('indicador em apuração não mantém número vigente e tem checagem de justificativa sem bloquear rascunho', () => {
  const proposal = structuredClone(initial);
  const indicator = data.indicators[0];
  editIndicator(proposal, data, indicator.id, { 'Em apuração? (Índice de Referência)': 'Não', 'Índice de Referência': '0' });
  assert.equal(proposal.planning.indicatorProposals[indicator.id].fields['Índice de Referência'], '0');
  editIndicator(proposal, data, indicator.id, { 'Em apuração? (Índice de Referência)': 'Sim' });
  const target = proposal.planning.indicatorProposals[indicator.id];
  assert.equal(target.fields['Índice de Referência'], '');
  assert.ok(indicatorPending(target).some((message) => message.includes('60 caracteres')));
  editIndicator(proposal, data, indicator.id, { 'Justificativa do Status em apuração do Índice de Referência': 'A apuração depende da conclusão e conferência dos registros administrativos do período.' });
  assert.ok(!indicatorPending(target).some((message) => message.includes('60 caracteres')));
  editIndicator(proposal, data, indicator.id, { 'Em apuração? (Índice de Referência)': 'Não' });
  assert.equal(target.fields['Índice de Referência'], '');
  assert.ok(indicatorPending(target).some((message) => message.includes('Índice numérico')));
  editIndicator(proposal, data, indicator.id, { 'Índice de Referência': '12,5' });
  assert.ok(!indicatorPending(target).some((message) => message.includes('numérico')));
  assert.equal(decodeState(encodeState(proposal, initial), initial).planning.indicatorProposals[indicator.id].fields['Índice de Referência'], '12,5');
  assert.throws(() => editIndicator(proposal, data, indicator.id, { 'Data Alteração': 'hoje' }), /sistema/);
});

test('território e vínculo de localizador importado não são sobrescritos; inclusão local conserva referência', () => {
  const proposal = structuredClone(initial);
  const localizer = data.localizers.find((record) => record.actionId);
  const original = JSON.stringify(localizer);
  proposal.planning.localizerProposals[localizer.id] = structuredClone(localizer);
  proposal.planning.localizerProposals[localizer.id].territories[0].fields.Município = 'Território inventado';
  assert.throws(() => enforceEditingUpdate(initial, proposal, data), /Território importado/);
  delete proposal.planning.localizerProposals[localizer.id];
  const action = proposal.actions.find((record) => record.id === localizer.actionId);
  draftLocalizer(proposal, action);
  const added = Object.values(proposal.planning.localizerProposals)[0];
  added.territories[0].fields = structuredClone(localizer.territories[0].fields);
  enforceEditingUpdate(initial, proposal, data);
  assert.equal(added.fields['Código do Localizador'], '');
  assert.notEqual(added.id, localizer.id);
  assert.equal(JSON.stringify(localizer), original);
});

test('exclusão usa novidade cadastral, tem histórico, restaura sem cascata e distingue descarte', () => {
  const proposal = structuredClone(initial);
  const old = proposal.programs.find((program) => program.officialFields['Programa Novo'] === 'Não');
  assert.throws(() => changeSituation(proposal, data, 'program', old.id, true), /justificativa/);
  changeSituation(proposal, data, 'program', old.id, true, 'Reorganização');
  changeSituation(proposal, data, 'program', old.id, false);
  assert.equal(old.officialFields['Exclusão Lógica do Programa'], 'Não');
  const newlyRegistered = proposal.programs.find((program) => program.officialFields['Programa Novo'] === 'Sim');
  assert.ok(newlyRegistered);
  changeSituation(proposal, data, 'program', newlyRegistered.id, true);
  assert.equal(proposal.planning.history.at(-1).reason, '');
  assert.equal(exclusionRequirement('indicator', { id: 'sem-novidade', fields: {}, origin: 'PPO' }).unknown, true);
  const draftId = draftProgram(proposal);
  discardDraft(proposal, data, 'program', draftId);
  assert.ok(!proposal.programs.some((program) => program.id === draftId));
  assert.equal(proposal.planning.history.at(-1).before.id, draftId);
  assert.throws(() => discardDraft(proposal, data, 'program', old.id), /importados/);
  enforceEditingUpdate(initial, proposal, data);
  assert.equal(proposal.actions.length, initial.actions.length);
});

test('revisão local perde situação revisada ao editar indicador ou localizador sem alterar validação oficial', () => {
  const before = structuredClone(initial);
  const indicator = data.indicators[0];
  const localizer = data.localizers.find((record) => record.actionId);
  before.planning.review[indicator.programId] = { status: 'revisado' };
  before.planning.review[localizer.actionId] = { status: 'revisado' };
  const after = structuredClone(before);
  editIndicator(after, data, indicator.id, { Fonte: 'Fonte reformulada' });
  changeSituation(after, data, 'localizer', localizer.id, true);
  enforceEditingUpdate(before, after, data);
  assert.equal(after.planning.review[indicator.programId].status, 'pendente');
  assert.equal(after.planning.review[localizer.actionId].status, 'pendente');
  assert.deepEqual(data.programs, initial.programs.map((record, index) => ({ ...record, sourceVariants: data.programs[index].sourceVariants })));
});

test('Leitor e Gestor UA são verificados também nas atualizações; rascunho continua incompleto', () => {
  const reader = structuredClone(initial);
  reader.perfil = 'Leitor';
  assert.throws(() => applyProgramFields(reader, reader.programs[0].id, { Objetivo: 'Não autorizado' }, data), /permissão/);
  assert.throws(() => draftProgram(reader), /permissão/);
  const changed = structuredClone(reader);
  changed.actions[0].nome = 'Não autorizado';
  assert.throws(() => enforceEditingUpdate(reader, changed, data), /permissão/);
  const scoped = structuredClone(initial);
  scoped.perfil = 'Gestor UA';
  const action = scoped.actions[0];
  scoped.unidade = action.unidadeOrcamentaria;
  assert.equal(canEditRecord(scoped, 'action', action), true);
  const other = scoped.actions.find((record) => normalizeCode(record.codigoUnidadeOrcamentaria) !== normalizeCode(action.codigoUnidadeOrcamentaria));
  assert.equal(canEditRecord(scoped, 'action', other), false);
  assert.throws(() => applyActionFields(scoped, other.id, { 'Título da Ação': 'Não autorizado' }, data), /permissão/);
});

test('mudança de programa/UO é proposta conferida e não transfere OBZ, MaPR ou localizadores', () => {
  const proposal = structuredClone(initial);
  const action = proposal.actions.find((record) => record.id === 'ppo-acao-125-1221-1082');
  const original = JSON.stringify([proposal.budgetItems, proposal.maps, proposal.planning.localizerProposals]);
  const other = data.actions.find((record) => record.id === 'ppo-acao-125-2461-4528');
  const fields = Object.fromEntries(['Código da Unidade Orçamentária Responsável pela Ação', 'Unidade Orçamentária Responsável pela Ação'].map((name) => [name, other.officialFields[name]]));
  assert.throws(() => applyActionFields(proposal, action.id, fields, data), /responsabilidade/);
  proposeAssociation(proposal, data, 'action', action.id, fields, 'Reorganização em análise', proposal.programs[0].id);
  enforceEditingUpdate(initial, proposal, data);
  const request = proposal.planning.associationRequests[0];
  assert.equal(action.codigoUnidadeOrcamentaria, initial.actions.find((record) => record.id === action.id).codigoUnidadeOrcamentaria);
  assert.equal(request.after.fields['Código da Unidade Orçamentária Responsável pela Ação'], other.codigoUnidadeOrcamentaria);
  assert.ok(request.affected.some((message) => message.includes('Localizador')));
  assert.ok(request.affected.some((message) => message.includes('MaPR')));
  assert.equal(JSON.stringify([proposal.budgetItems, proposal.maps, proposal.planning.localizerProposals]), original);
});

test('migração das regras preserva cópia v2 anterior e não apaga conteúdo já editado', () => {
  const previous = structuredClone(initial);
  delete previous.planning.editingVersion;
  previous.programs[0].objetivo = 'Conteúdo local anterior às regras';
  const raw = encodeState(previous, initial);
  const entries = new Map([[STORAGE_KEY, raw]]);
  const storage = { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  const loaded = readPersisted(storage, initial, legacy);
  assert.equal(loaded.programs[0].objetivo, 'Conteúdo local anterior às regras');
  assert.equal(entries.get(`${STORAGE_KEY}-before-editing-rules`), raw);
  assert.equal(loaded.planning.editingVersion, 1);
  assert.ok(loaded.planning.migrationNotices.some((message) => message.includes('não foram apagadas')));
});

test('restauração de localizador com várias relações tem situação explícita sem regravar territórios', () => {
  const proposal = structuredClone(initial);
  const localizer = structuredClone(data.localizers.find((record) => record.actionId));
  localizer.fields['Exclusão Lógica do Localizador'] = 'Não';
  localizer.territories.push({ ...structuredClone(localizer.territories[0]), id: 'outra-relacao-territorial' });
  localizer.territories[0].statusFields['Exclusão Lógica do Localizador'] = 'Sim';
  localizer.territories[1].statusFields['Exclusão Lógica do Localizador'] = 'Não';
  const reference = { ...data, localizers: [localizer] };
  changeSituation(proposal, reference, 'localizer', localizer.id, false);
  enforceEditingUpdate(initial, proposal, reference);
  const target = proposal.planning.localizerProposals[localizer.id];
  assert.equal(target.exclusionProposal, false);
  assert.deepEqual(target.territories, localizer.territories);
  assert.equal(proposal.planning.history.at(-1).operation, 'restauracao');
});
