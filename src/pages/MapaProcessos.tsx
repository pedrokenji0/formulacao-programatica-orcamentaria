import { useState } from 'react';
import { useApp } from '../store/AppStore';
import { mockApi } from '../services/mockApi';
import { Card, Tabs, FormField, ActionButton, ChipList, useToast, uid } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { MapVisualizer } from '../components/MapVisualizer';
import { ValidationPanel, type Issue } from '../components/ValidationPanel';
import { CoherenceScore } from '../components/CoherenceScore';
import type { Action, ProcessMap, ProcessAction, MapItem } from '../types';
import { Link2, Plus, Trash2, Save } from 'lucide-react';

function emptyMap(programId: string, problema: string): ProcessMap {
  return { programId, problemaCentral: problema, contexto: [], premissas: [], resultados: [], impactos: [], actions: [], status: 'RASCUNHO' };
}

// add-row com estado local (evita re-render global ao digitar)
function AddRow({ categorias, onAdd, placeholder, disabled }: { categorias?: string[]; onAdd: (texto: string, cat?: string) => void; placeholder: string; disabled?: boolean }) {
  const [texto, setTexto] = useState(''); const [cat, setCat] = useState('');
  return (
    <div className="add-row">
      {categorias && (
        <select value={cat} disabled={disabled} onChange={(e) => setCat(e.target.value)} style={{ border: '1px solid #ccd6dc', borderRadius: 9, padding: '9px 11px' }}>
          <option value="">Categoria (opcional)</option>{categorias.map((c) => <option key={c}>{c}</option>)}
        </select>
      )}
      <input value={texto} disabled={disabled} placeholder={placeholder} onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && texto.trim()) { onAdd(texto.trim(), cat || undefined); setTexto(''); setCat(''); } }}
        style={{ border: '1px solid #ccd6dc', borderRadius: 9, padding: '9px 11px' }} />
      <ActionButton color="green" icon={<Plus size={15} />} disabled={disabled} onClick={() => { if (texto.trim()) { onAdd(texto.trim(), cat || undefined); setTexto(''); setCat(''); } }}>Criar</ActionButton>
    </div>
  );
}

export function MapaProcessosPage({ initialTab }: { initialTab?: string }) {
  const { state, update, can } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState(initialTab || 'preenchimento');
  const pid = state.currentProgramId;
  const prog = state.programs.find((p) => p.id === pid)!;
  let map = state.maps.find((m) => m.programId === pid);
  if (!map) map = emptyMap(pid, prog.problemaCentral);
  const editable = can('editMapa');
  const [filterAction, setFilterAction] = useState('');
  const [catalogActionId, setCatalogActionId] = useState('');

  const updateMap = (fn: (m: ProcessMap) => void) => update((s) => {
    let m = s.maps.find((x) => x.programId === pid);
    if (!m) { m = emptyMap(pid, s.programs.find((p) => p.id === pid)!.problemaCentral); s.maps.push(m); }
    fn(m);
  });

  const tabs = [
    { id: 'preenchimento', label: 'Preenchimento' },
    { id: 'subcategorias', label: 'Subcategorias' },
    { id: 'visualizacao', label: 'Visualização do Mapa' },
    { id: 'validacao', label: 'Validação do Desenho' },
  ];

  const obzCount: Record<string, number> = {};
  for (const a of map.actions) obzCount[a.id] = state.budgetItems.filter((b) => b.programaId === pid && (b.acaoLabel.startsWith(a.codigo) || b.actionId.includes(a.codigo))).length;
  const catalogActions = state.actions.filter((a) => a.programaId === pid);
  const availableCatalogActions = catalogActions.filter((a) => !map.actions.some((m) => m.codigo === a.codigo));
  const addMappedAction = (a?: Action) => update((s) => {
    const m = s.maps.find((x) => x.programId === pid) || emptyMap(pid, prog.problemaCentral);
    if (!s.maps.includes(m)) s.maps.push(m);
    if (a) {
      m.actions.push({ id: uid('pa'), codigo: a.codigo, nome: a.nome, objetivo: a.finalidade || a.descricao || '', publicoAlvo: a.publicoAlvo, recursos: [], atividades: [], produtos: a.produto ? [{ id: uid('prod'), texto: a.produto, categoria: a.unidadeMedida ? `Unidade: ${a.unidadeMedida}` : undefined }] : [], pressupostos: [], riscos: [] });
    } else {
      const code = String(Date.now()).slice(-4);
      const actionId = uid('act');
      s.actions.push({ id: actionId, codigo: code, nome: 'Nova ação', programaId: pid, unidadeOrcamentaria: prog.unidadeOrcamentaria, orgao: prog.orgao, funcao: '', subfuncao: '', tipoAcao: 'Atividade Fim do Orçamento Fiscal', iag: '', publicoAlvo: '', produto: '', especificacaoProduto: '', unidadeMedida: '', finalidade: '', descricao: '', baseLegal: '', status: 'RASCUNHO' });
      m.actions.push({ id: uid('pa'), codigo: code, nome: 'Nova ação', objetivo: '', publicoAlvo: '', recursos: [], atividades: [], produtos: [], pressupostos: [], riscos: [] });
    }
  });

  return (
    <>
      <PageHeader crumb="Formulação do Programa › Mapa de Processos e Resultados" title="Mapa de Processos e Resultados"
        sub="Cadeia: Recursos/Insumos → Atividades → Produtos → Resultados → Impactos. Campos do programa e das ações." status={map.status} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'preenchimento' && (
        <>
          <Card title="Programa" scope="PROGRAMA"
            actions={<ActionButton color="green" icon={<Save size={16} />} disabled={!editable} onClick={() => { updateMap((m) => { m.status = 'EM PREENCHIMENTO'; }); toast('Mapa salvo.', 'ok'); }}>Salvar rascunho</ActionButton>}>
            <FormField label="Problema central" textarea value={map.problemaCentral} disabled={!editable} onChange={(v) => updateMap((m) => { m.problemaCentral = v; })} />
            <ProgramList label="Contexto" items={map.contexto} editable={editable}
              onAdd={(t, c) => updateMap((m) => m.contexto.push({ id: uid('ctx'), texto: t, categoria: c }))}
              onRemove={(id) => updateMap((m) => { m.contexto = m.contexto.filter((x) => x.id !== id); })} placeholder="Elemento de contexto..." />
            <ProgramList label="Premissas abertas do programa" items={map.premissas || []} editable={editable}
              onAdd={(t, c) => updateMap((m) => { if (!m.premissas) m.premissas = []; m.premissas.push({ id: uid('pre'), texto: t, categoria: c }); })}
              onRemove={(id) => updateMap((m) => { m.premissas = (m.premissas || []).filter((x) => x.id !== id); })} placeholder="Premissa, restrição ou condição externa..." />
            <ProgramList label="Resultados esperados" items={map.resultados} editable={editable}
              onAdd={(t, c) => updateMap((m) => m.resultados.push({ id: uid('res'), texto: t, categoria: c }))}
              onRemove={(id) => updateMap((m) => { m.resultados = m.resultados.filter((x) => x.id !== id); })} placeholder="Resultado esperado..." />
            <ProgramList label="Impactos" items={map.impactos} editable={editable}
              onAdd={(t, c) => updateMap((m) => m.impactos.push({ id: uid('imp'), texto: t, categoria: c }))}
              onRemove={(id) => updateMap((m) => { m.impactos = m.impactos.filter((x) => x.id !== id); })} placeholder="Impacto de longo prazo..." />
          </Card>

          <Card title="Ações do Programa" scope="AÇÃO" count={map.actions.length}
            actions={<ActionButton color="green" icon={<Plus size={16} />} disabled={!editable} onClick={() => addMappedAction()}>Criar nova ação</ActionButton>}
            lead="Selecione ações já existentes/importadas, ou crie uma ação nova. Depois preencha recursos reais, até 5 atividades e produto principal.">
            <div className="action-catalog-row">
              <select value={catalogActionId} disabled={!editable || availableCatalogActions.length === 0} onChange={(e) => setCatalogActionId(e.target.value)}>
                <option value="">Selecionar ação existente...</option>
                {availableCatalogActions.map((a) => <option key={a.id} value={a.id}>{a.codigo} — {a.nome}</option>)}
              </select>
              <ActionButton color="blue" icon={<Link2 size={16} />} disabled={!editable || !catalogActionId} onClick={() => { addMappedAction(catalogActions.find((a) => a.id === catalogActionId)); setCatalogActionId(''); }}>Vincular ao mapa</ActionButton>
            </div>
            {map.actions.length === 0 && <div className="empty">Nenhuma ação. Adicione uma ação ou importe a OBZ.</div>}
          </Card>

          {map.actions.map((a) => (
            <ActionCard key={a.id} a={a} editable={editable} lists={state.lists} catalogActions={catalogActions} update={update} pid={pid} updateMap={updateMap} />
          ))}
        </>
      )}

      {tab === 'subcategorias' && <SubcategoriasTab />}

      {tab === 'visualizacao' && (
        <Card title="Visualização do Mapa"
          actions={<select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} style={{ border: '1px solid #ccd6dc', borderRadius: 8, padding: '7px 10px' }}>
            <option value="">Todas as ações</option>{map.actions.map((a) => <option key={a.id} value={a.id}>{a.codigo} — {a.nome}</option>)}
          </select>}>
          <MapVisualizer map={map} actionId={filterAction || undefined} obzCount={obzCount} />
        </Card>
      )}

      {tab === 'validacao' && <ValidacaoTab map={map} pid={pid} />}
    </>
  );
}

function ProgramList({ label, items, editable, onAdd, onRemove, placeholder }: any) {
  return (
    <div style={{ marginTop: 6 }}>
      <label style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink-2)' }}>{label}</label>
      <AddRow onAdd={onAdd} placeholder={placeholder} disabled={!editable} />
      <ChipList items={items} onRemove={editable ? onRemove : undefined} />
    </div>
  );
}

function ActionCard({ a, editable, lists, catalogActions, update, pid, updateMap }: {
  a: ProcessAction; editable: boolean; lists: any; catalogActions: Action[]; update: any; pid: string; updateMap: (fn: (m: ProcessMap) => void) => void;
}) {
  const toast = useToast();
  const catalog = catalogActions.find((x) => x.codigo === a.codigo);
  const setField = (k: string, v: string) => update((s: any) => {
    const m = s.maps.find((x: ProcessMap) => x.programId === pid);
    const x = m?.actions.find((y: ProcessAction) => y.id === a.id);
    const oldCode = x?.codigo;
    if (x) (x as any)[k] = v;
    const act = s.actions.find((act: Action) => act.programaId === pid && act.codigo === oldCode);
    if (act) {
      if (k === 'codigo') act.codigo = v;
      if (k === 'nome') act.nome = v;
      if (k === 'publicoAlvo') act.publicoAlvo = v;
      if (k === 'objetivo') act.finalidade = v;
    }
  });
  const addItem = (sec: keyof ProcessAction, t: string, c?: string, publicos?: string[], preProduto?: string) => updateMap((m) => {
    const x = m.actions.find((y) => y.id === a.id) as any;
    if (sec === 'atividades' && x.atividades.length >= 5) { toast('Limite de 5 atividades por ação.', 'err'); return; }
    x[sec].push({ id: uid('mi'), texto: t, categoria: c, publicos, preProduto });
  });
  const rmItem = (sec: keyof ProcessAction, id: string) => updateMap((m) => { const x = m.actions.find((y) => y.id === a.id) as any; x[sec] = x[sec].filter((i: MapItem) => i.id !== id); });
  const del = () => updateMap((m) => { m.actions = m.actions.filter((y) => y.id !== a.id); });

  return (
    <Card title={<>Ação {a.codigo || ''} <span className="muted small">{a.nome}</span></>}
      actions={<button className="icobtn del" disabled={!editable} onClick={del}><Trash2 size={14} /></button>}>
      <div className="locked-fields">
        <span className="badge gray">travados após criação: código, programa, UO, órgão e tipo de ação</span>
        <span className="badge blue">alteráveis: nome, unidade administrativa, função, subfunção, IAG e campos qualitativos</span>
      </div>
      <div className="grid g3">
        <FormField label="Código da ação" value={a.codigo} disabled={!editable} onChange={(v) => setField('codigo', v)} />
        <FormField label="Nome da ação" value={a.nome} disabled={!editable} onChange={(v) => setField('nome', v)} />
        <FormField label="Público-alvo" value={a.publicoAlvo} disabled={!editable} onChange={(v) => setField('publicoAlvo', v)} />
      </div>
      {catalog && (
        <div className="grid g4 locked-preview">
          <div><span>Programa</span><b>{catalog.programaId}</b></div>
          <div><span>UO responsável</span><b>{catalog.unidadeOrcamentaria || '—'}</b></div>
          <div><span>Órgão</span><b>{catalog.orgao || '—'}</b></div>
          <div><span>Tipo</span><b>{catalog.tipoAcao || '—'}</b></div>
        </div>
      )}
      <FormField label="Objetivo / finalidade da ação" textarea value={a.objetivo} disabled={!editable} onChange={(v) => setField('objetivo', v)} />

      <Sub label="Recursos reais" items={a.recursos} cats={lists.categoriasRecurso} editable={editable}
        onAdd={(t: string, c?: string) => addItem('recursos', t, c)} onRemove={(id: string) => rmItem('recursos', id)} ph="Recurso/insumo..." />
      <AtividadesSub items={a.atividades} cats={lists.categoriasAtividade} editable={editable}
        onAdd={(t: string, c?: string, pre?: string) => addItem('atividades', t, c, undefined, pre)} onRemove={(id: string) => rmItem('atividades', id)} />
      <ProdutoSub a={a} editable={editable} publicos={lists.publicos} onAdd={(t: string, p: string[]) => addItem('produtos', t, undefined, p)} onRemove={(id: string) => rmItem('produtos', id)} />
    </Card>
  );
}

function Sub({ label, items, cats, editable, onAdd, onRemove, ph }: any) {
  return (
    <div style={{ marginTop: 12, borderTop: '1px dashed var(--line-soft)', paddingTop: 10 }}>
      <label style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{label} <span className="pill-count">{items.length}</span></label>
      <AddRow categorias={cats} onAdd={onAdd} placeholder={ph} disabled={!editable} />
      <ChipList items={items} onRemove={editable ? onRemove : undefined} />
    </div>
  );
}

function AtividadesSub({ items, cats, editable, onAdd, onRemove }: any) {
  const [texto, setTexto] = useState('');
  const [cat, setCat] = useState('');
  const [pre, setPre] = useState('');
  const add = () => {
    if (!texto.trim()) return;
    onAdd(texto.trim(), cat || undefined, pre.trim() || undefined);
    setTexto(''); setCat(''); setPre('');
  };
  return (
    <div style={{ marginTop: 12, borderTop: '1px dashed var(--line-soft)', paddingTop: 10 }}>
      <label style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>Atividades / Processos <span className="pill-count">{items.length}/5</span></label>
      <div className="add-row activity-add">
        <select value={cat} disabled={disabledOrLimit(editable, items)} onChange={(e) => setCat(e.target.value)} style={{ border: '1px solid #ccd6dc', borderRadius: 9, padding: '9px 11px' }}>
          <option value="">Categoria (opcional)</option>{cats.map((c: string) => <option key={c}>{c}</option>)}
        </select>
        <input value={texto} disabled={disabledOrLimit(editable, items)} placeholder="Atividade/processo..." onChange={(e) => setTexto(e.target.value)} style={{ border: '1px solid #ccd6dc', borderRadius: 9, padding: '9px 11px' }} />
        <input value={pre} disabled={disabledOrLimit(editable, items)} placeholder="Pré-produto opcional..." onChange={(e) => setPre(e.target.value)} style={{ border: '1px solid #ccd6dc', borderRadius: 9, padding: '9px 11px' }} />
        <ActionButton color="green" icon={<Plus size={15} />} disabled={disabledOrLimit(editable, items)} onClick={add}>Criar</ActionButton>
      </div>
      <ChipList items={items} onRemove={editable ? onRemove : undefined} render={(i) => <>{i.texto}{i.preProduto && <span className="pre-product">pré-produto: {i.preProduto}</span>}</>} />
      {items.length >= 5 && <div className="alert warn" style={{ marginTop: 8 }}>Limite de 5 atividades atingido para esta ação.</div>}
    </div>
  );
}

function disabledOrLimit(editable: boolean, items: any[]) {
  return !editable || items.length >= 5;
}

function ProdutoSub({ a, editable, publicos, onAdd, onRemove }: any) {
  const [texto, setTexto] = useState(''); const [sel, setSel] = useState<string[]>([]);
  const toggle = (p: string) => setSel((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p]);
  return (
    <div style={{ marginTop: 12, borderTop: '1px dashed var(--line-soft)', paddingTop: 10 }}>
      <label style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>Produtos / Entregas <span className="pill-count">{a.produtos.length}</span></label>
      <div className="add-row">
        <input value={texto} disabled={!editable} placeholder="Produto/entrega..." onChange={(e) => setTexto(e.target.value)} style={{ border: '1px solid #ccd6dc', borderRadius: 9, padding: '9px 11px' }} />
        <ActionButton color="green" icon={<Plus size={15} />} disabled={!editable} onClick={() => { if (texto.trim()) { onAdd(texto.trim(), sel); setTexto(''); setSel([]); } }}>Criar</ActionButton>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {publicos.map((p: string) => (
          <button key={p} type="button" disabled={!editable} onClick={() => toggle(p)}
            className={'badge ' + (sel.includes(p) ? 'blue' : 'gray')} style={{ cursor: 'pointer', border: 'none' }}>{p}</button>
        ))}
      </div>
      <ChipList items={a.produtos} onRemove={editable ? onRemove : undefined} />
    </div>
  );
}

function SubcategoriasTab() {
  const { state, update } = useApp();
  const lists: { key: keyof typeof state.lists; label: string }[] = [
    { key: 'categoriasRecurso', label: 'Categorias de Recursos' },
    { key: 'categoriasAtividade', label: 'Categorias de Atividades' },
    { key: 'categoriasProduto', label: 'Categorias de Produtos' },
    { key: 'publicos', label: 'Públicos-alvo' },
  ];
  return (
    <Card title="Subcategorias do Mapa" lead="Listas usadas nos seletores de recursos, atividades, produtos e públicos. Refletem em todo o módulo.">
      <div className="grid g2">
        {lists.map((l) => (
          <div key={l.key as string}>
            <label style={{ fontWeight: 700, fontSize: 13 }}>{l.label}</label>
            <AddRow onAdd={(t) => update((s) => { (s.lists[l.key] as string[]).push(t); })} placeholder={`Nova ${l.label.toLowerCase()}...`} />
            <ChipList items={(state.lists[l.key] as string[]).map((v, i) => ({ id: l.key + i, texto: v }))}
              onRemove={(id) => update((s) => { const idx = Number(String(id).replace(l.key as string, '')); (s.lists[l.key] as string[]).splice(idx, 1); })} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ValidacaoTab({ map, pid }: { map: ProcessMap; pid: string }) {
  const issues: Issue[] = [];
  if (!map.problemaCentral.trim()) issues.push({ level: 'err', text: 'Problema central vazio.' });
  if (map.actions.length === 0) issues.push({ level: 'err', text: 'Nenhuma ação cadastrada.' });
  for (const a of map.actions) {
    const nm = `Ação ${a.codigo || a.nome}`;
    if (!a.publicoAlvo.trim()) issues.push({ level: 'warn', text: `${nm}: público-alvo vazio.` });
    if (a.produtos.length === 0) issues.push({ level: 'err', text: `${nm}: sem produto.` });
    if (a.atividades.length === 0) issues.push({ level: 'err', text: `${nm}: sem atividade.` });
    if (a.recursos.length === 0) issues.push({ level: 'warn', text: `${nm}: sem recurso.` });
  }
  if (map.resultados.length === 0) issues.push({ level: 'err', text: 'Programa sem resultados (produtos sem efeito).' });
  if (map.impactos.length === 0) issues.push({ level: 'warn', text: 'Programa sem impactos (resultados sem impacto).' });
  const score = mockApi.calculateCoherenceScore(pid);

  return (
    <div className="grid g2">
      <Card title="Painel de alertas"><ValidationPanel issues={issues} /></Card>
      <Card title="Nota de coerência"><CoherenceScore value={score} label="Coerência do desenho (0–100)" sub="Baseada na completude da cadeia causal." /></Card>
    </div>
  );
}
