import { useState, type ReactNode } from 'react';
import { useApp } from '../../store/AppStore';
import { Card, ActionButton, FormField, Modal, Tabs } from '../../components/ui';
import { MapVisualizer, type MapSection } from '../../components/MapVisualizer';
import { MapReferences } from '../../components/MapReferences';
import { stableLocalId, normalizeCode } from '../../services/planningDomain';
import { BookOpen, ListTree, ClipboardCheck, Settings } from 'lucide-react';
import type { Action, ProcessMap, ProcessAction, MapItem } from '../../types';

const PROGRAM_SECTIONS = [{ id: 'identificacao', label: 'Necessidade de atuação' }, { id: 'contexto', label: 'Contexto' }, { id: 'premissas', label: 'Premissas' }, { id: 'causas', label: 'Causas' }, { id: 'resultados', label: 'Resultados' }, { id: 'impactos', label: 'Impactos' }];
const ACTION_SECTIONS = [{ id: 'identificacao', label: 'Identificação' }, { id: 'recursos', label: 'Recursos' }, { id: 'atividades', label: 'Atividades' }, { id: 'produtoPrincipal', label: 'Produto principal' }, { id: 'produtosSecundarios', label: 'Entregas secundárias' }, { id: 'resultados', label: 'Resultados' }, { id: 'impactos', label: 'Impactos' }, { id: 'pressupostos', label: 'Pressupostos' }, { id: 'riscos', label: 'Riscos' }];

export function IntegratedMap({ map, updateMap, editable, availableActions, onAddAction, renderActionEditor, categories, validation }: {
  map: ProcessMap; updateMap: (apply: (target: ProcessMap) => void) => void; editable: boolean;
  availableActions: Action[]; onAddAction: (action?: Action) => void;
  renderActionEditor: (action: ProcessAction, section: MapSection) => ReactNode; categories: ReactNode; validation: ReactNode;
}) {
  const { state, can } = useApp();
  const [selectedAction, setSelectedAction] = useState(map.actions.find((action) => normalizeCode(action.codigo) === '1082' && normalizeCode(action.codigoUnidadeOrcamentaria) === '1221')?.id || map.actions[0]?.id || '*');
  const [editor, setEditor] = useState<{ section: MapSection; actionId?: string } | null>(null);
  const [dialog, setDialog] = useState('');
  const [referenceTab, setReferenceTab] = useState('referencias');
  const [catalogId, setCatalogId] = useState('');
  const action = map.actions.find((record) => record.id === editor?.actionId);
  const selected = selectedAction === '*' || map.actions.some((record) => record.id === selectedAction) ? selectedAction : map.actions[0]?.id || '*';
  const program = state.programs.find((record) => record.id === map.programId)!;
  return <Card title="Mapa de Processos e Resultados" lead="Explore a cadeia e edite cada bloco na própria visualização. Textos longos ficam recolhidos até você abrir “Ver mais”." actions={can('adminTabelas') ? <ActionButton sm color="ghost" icon={<Settings size={16} />} onClick={() => setDialog('categorias')}>Tabelas de apoio</ActionButton> : undefined}>
    <nav className="map-workspace-shortcuts" aria-label="Ferramentas do mapa">
      <button className="map-shortcut references" aria-label="Relacionar cadastro" type="button" onClick={() => setDialog('referencias')}><BookOpen size={22} /><span><strong>Relacionar cadastro</strong><small>Consultar cadastro e confirmar associações</small></span></button>
      <button className="map-shortcut actions" aria-label="Gerenciar ações" type="button" onClick={() => setDialog('acoes')}><ListTree size={22} /><span><strong>Gerenciar ações</strong><small>Vincular ações e preservar suas UOs</small></span></button>
      <button className="map-shortcut validation" aria-label="Validar desenho" type="button" onClick={() => setDialog('validacao')}><ClipboardCheck size={22} /><span><strong>Validar desenho</strong><small>Conferir a cadeia e suas pendências</small></span></button>
    </nav>
    <div className="map-workspace-toolbar">
      <label className="planning-selector">Ação no mapa<select aria-label="Ação no mapa" value={selected} onChange={(event) => setSelectedAction(event.target.value)}><option value="*">Todas as ações</option>{map.actions.map((record) => <option key={record.id} value={record.id}>{record.codigo || 'Local'} · UO {record.codigoUnidadeOrcamentaria || 'local'} · {record.nome}</option>)}</select></label>
      <span className="small muted">Clique em Editar ou Adicionar em qualquer bloco · até 8 linhas por grupo e ação</span>
    </div>
    <MapVisualizer key={map.programId} map={map} actionId={selected === '*' ? undefined : selected} onEdit={(section, actionId) => setEditor({ section, actionId })} />
    {editor && <Modal wide title={action ? `Editar ação ${action.codigo || 'local'} · UO ${action.codigoUnidadeOrcamentaria || 'local'}` : 'Programa e contexto do mapa'} sub="Alterações salvas automaticamente · o mapa permanece ao fundo" onClose={() => setEditor(null)} foot={<ActionButton onClick={() => setEditor(null)}>Concluir</ActionButton>}>
      <Tabs tabs={action ? ACTION_SECTIONS : PROGRAM_SECTIONS} active={editor.section} onChange={(section) => setEditor({ ...editor, section: section as MapSection })} />
      {action ? renderActionEditor(action, editor.section) : editor.section === 'identificacao'
        ? <FormField label="Problema ou necessidade de atuação" textarea value={map.problemaCentral} disabled={!editable} onChange={(value) => updateMap((target) => { target.problemaCentral = value; })} hint="Que situação se pretende alcançar, melhorar ou preservar?" />
        : <ProgramMapItems map={map} section={editor.section} updateMap={updateMap} editable={editable} />}
    </Modal>}
    {dialog === 'referencias' && <Modal wide title="Cadastro e associações" onClose={() => setDialog('')}>
      <Tabs tabs={[{ id: 'referencias', label: 'Cadastro existente' }, { id: 'associacoes', label: 'Associações' }]} active={referenceTab} onChange={setReferenceTab} />
      <MapReferences map={map} updateMap={updateMap} editable={editable} section={referenceTab} initialActionId={selected === '*' ? undefined : selected} />
    </Modal>}
    {dialog === 'acoes' && <Modal title="Gerenciar ações do mapa" onClose={() => setDialog('')}>
      <p className="small muted">Ações do programa {program.codigo}. Cada vínculo preserva sua unidade orçamentária.</p>
      <label className="planning-selector">Ação existente<select aria-label="Ação existente" value={catalogId} onChange={(event) => setCatalogId(event.target.value)}><option value="">Selecione uma ação para vincular</option>{availableActions.map((record) => <option key={record.id} value={record.id}>{record.codigo} · UO {record.codigoUnidadeOrcamentaria} · {record.nome}</option>)}</select></label>
      <div className="row"><ActionButton disabled={!editable || !catalogId} onClick={() => { onAddAction(availableActions.find((record) => record.id === catalogId)); setSelectedAction(catalogId); setCatalogId(''); }}>Vincular ao mapa</ActionButton><ActionButton color="ghost" disabled={!editable} onClick={() => onAddAction()}>Criar nova ação local</ActionButton></div>
    </Modal>}
    {dialog === 'categorias' && can('adminTabelas') && <Modal wide title="Gestão de tabelas de apoio" sub="Administração do mockup · listas compartilhadas pelos mapas" onClose={() => setDialog('')}><Tabs tabs={[{ id: 'subcategorias', label: 'Subcategorias e públicos-alvo' }]} active="subcategorias" onChange={() => {}} />{categories}</Modal>}
    {dialog === 'validacao' && <Modal wide title="Validação do desenho" onClose={() => setDialog('')}>{validation}</Modal>}
  </Card>;
}

function ProgramMapItems({ map, section, updateMap, editable }: { map: ProcessMap; section: MapSection; updateMap: (apply: (target: ProcessMap) => void) => void; editable: boolean }) {
  const [text, setText] = useState('');
  const key = section as 'contexto' | 'premissas' | 'causas' | 'resultados' | 'impactos';
  const items: MapItem[] = map[key] || [];
  const label = PROGRAM_SECTIONS.find((record) => record.id === section)?.label || section;
  return <div>
    {items.map((item, index) => <div key={item.id} className="map-item-editor"><FormField label={`${label} — item ${index + 1}`} textarea value={item.texto} disabled={!editable} onChange={(value) => updateMap((target) => { const record = target[key]!.find((candidate) => candidate.id === item.id)!; record.texto = value; record.origin = 'local'; })} /><ActionButton sm color="ghost" disabled={!editable} onClick={() => updateMap((target) => { target[key] = target[key]!.filter((record) => record.id !== item.id); })}>Remover item {index + 1}</ActionButton></div>)}
    {!items.length && <p className="small muted">Nenhum item registrado neste bloco.</p>}
    <FormField label={`Novo item — ${label}`} textarea value={text} disabled={!editable} onChange={setText} />
    <ActionButton disabled={!editable || !text.trim()} onClick={() => { updateMap((target) => { target[key] ||= []; target[key]!.push({ id: stableLocalId(key), texto: text.trim(), origin: 'local' }); }); setText(''); }}>Adicionar ao mapa</ActionButton>
  </div>;
}
