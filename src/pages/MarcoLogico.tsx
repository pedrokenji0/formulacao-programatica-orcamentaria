import { useState } from 'react';
import { useApp } from '../store/AppStore';
import { mockApi } from '../services/mockApi';
import { Card, Tabs, FormField, SelectField, ActionButton, useToast, uid } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { TreeVisualizer } from '../components/TreeVisualizer';
import { CoherenceScore } from '../components/CoherenceScore';
import { DataTable } from '../components/DataTable';
import type { LogicalFramework, Program, ProblemNode, ProblemNodeType, InvolvedActor, Alternative } from '../types';
import { Save, Plus, Trash2, GitBranch, Wand2, ArrowRight, Search } from 'lucide-react';

const PROBLEM_TYPES: ProblemNodeType[] = ['causa estrutural', 'causa maior', 'causa superficial', 'problema central', 'consequência direta', 'consequência final', 'parâmetro externo'];

function emptyFw(programId: string): LogicalFramework {
  return {
    programId, problemTheory: { territorio: '', publicoAfetado: '', problemaCentral: '', situacaoAtual: '', evidencias: '', fonteEvidencias: '', justificativa: '', hipotesesCausais: '', limitacoesExternas: '', situacaoFutura: '', observacoes: '' },
    involvedActors: [], problemNodes: [], objectiveNodes: [], alternatives: [], criteria: [{ id: 'c1', nome: 'Custo', peso: 2 }, { id: 'c2', nome: 'Impacto', peso: 3 }, { id: 'c3', nome: 'Viabilidade', peso: 2 }], selectedAlternativeId: null, synthesis: '', status: 'RASCUNHO',
  };
}

export function MarcoLogicoPage({ initialTab }: { initialTab?: string }) {
  const { state, update, can, setCurrentProgram } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState(initialTab || 'teoria');
  const pid = state.currentProgramId;
  const prog = state.programs.find((p) => p.id === pid)!;
  let fw = state.frameworks.find((f) => f.programId === pid);
  const editable = can('editMarcoLogico');

  const updateFw = (fn: (f: LogicalFramework) => void) => update((s) => {
    let f = s.frameworks.find((x) => x.programId === pid);
    if (!f) { f = emptyFw(pid); s.frameworks.push(f); }
    fn(f);
  });
  if (!fw) fw = emptyFw(pid);

  const updateProgram = (k: keyof Program, v: string) => update((s) => {
    const p = s.programs.find((x) => x.id === pid);
    if (p) (p as any)[k] = v;
  });
  const createProgram = () => {
    const id = uid('prog');
    update((s) => {
      s.programs.push({
        id, codigo: '', nome: 'Novo programa', unidadeAdministrativa: '',
        unidadeOrcamentaria: s.unidade, orgao: '', areaTematica: '',
        problemaCentral: '', objetivo: '', justificativa: '', publicoAlvo: '', contexto: '',
        horizonteTemporal: '', tipoPrograma: '', indicador: '', resultados: [], impactos: [], status: 'RASCUNHO',
      });
      s.frameworks.push(emptyFw(id));
      s.currentProgramId = id;
    });
    toast('Programa criado. Preencha os campos principais.', 'ok');
  };
  const deleteProgram = () => {
    if (state.programs.length <= 1) { toast('Mantenha ao menos um programa no protótipo.', 'err'); return; }
    if (!confirm(`Excluir o programa ${prog.codigo || ''} ${prog.nome}?`)) return;
    update((s) => {
      s.programs = s.programs.filter((p) => p.id !== pid);
      s.frameworks = s.frameworks.filter((f) => f.programId !== pid);
      s.maps = s.maps.filter((m) => m.programId !== pid);
      s.budgetItems = s.budgetItems.filter((b) => b.programaId !== pid);
      s.mirrors = s.mirrors.filter((m) => m.programId !== pid);
      s.currentProgramId = s.programs[0]?.id || '';
    });
    toast('Programa excluído.', 'ok');
  };

  const tabs = [
    { id: 'teoria', label: 'Teoria / Preenchimento' },
    { id: 'arvores', label: 'Árvores' },
    { id: 'alternativas', label: 'Análise de Alternativas e Síntese' },
  ];

  return (
    <>
      <PageHeader crumb="1.1 Programação Qualitativa" title="Teoria do Problema e desenho do programa"
        sub="Preenchimento enxuto para construir as duas árvores, escolher alternativas e preparar o Mapa de Processos e Resultados." status={fw.status} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'teoria' && <TeoriaTab fw={fw} prog={prog} programs={state.programs} editable={editable}
        updateFw={updateFw} updateProgram={updateProgram} onSelectProgram={setCurrentProgram}
        onCreateProgram={createProgram} onDeleteProgram={deleteProgram}
        onSave={() => { updateFw((f) => { f.status = 'EM PREENCHIMENTO'; }); toast('Teoria do problema salva.', 'ok'); }} />}
      {tab === 'arvores' && <ArvoresTab fw={fw} editable={editable} updateFw={updateFw} toast={toast} />}
      {tab === 'alternativas' && <AlternativasTab fw={fw} prog={prog} editable={editable} updateFw={updateFw} toast={toast} />}
    </>
  );
}

// ---- Teoria do problema ----
function TeoriaTab({ fw, prog, programs, editable, updateFw, updateProgram, onSelectProgram, onCreateProgram, onDeleteProgram, onSave }: any) {
  const pt = fw.problemTheory;
  const set = (k: string, v: string) => updateFw((f: LogicalFramework) => { (f.problemTheory as any)[k] = v; });
  return (
    <>
      <Card title="Pesquisar, editar ou criar programa" scope="PROGRAMA"
        actions={<>
          <ActionButton color="green" icon={<Plus size={16} />} disabled={!editable} onClick={onCreateProgram}>Criar programa</ActionButton>
          <ActionButton color="red" icon={<Trash2 size={16} />} disabled={!editable} onClick={onDeleteProgram}>Excluir</ActionButton>
        </>}>
        <div className="field compact-search">
          <label>Programa ativo</label>
          <div className="search-select">
            <Search size={16} />
            <select value={prog.id} onChange={(e) => onSelectProgram(e.target.value)}>
              {programs.map((p: Program) => <option key={p.id} value={p.id}>{p.codigo || 'sem código'} — {p.nome} · {p.orgao || 'sem órgão'}</option>)}
            </select>
          </div>
        </div>
        <div className="grid g4">
          <FormField label="Código" value={prog.codigo} onChange={(v) => updateProgram('codigo', v)} disabled={!editable} />
          <FormField label="Programa" value={prog.nome} onChange={(v) => updateProgram('nome', v)} disabled={!editable} />
          <FormField label="Unidade Administrativa" value={prog.unidadeAdministrativa || ''} onChange={(v) => updateProgram('unidadeAdministrativa', v)} disabled={!editable} />
          <FormField label="Área Temática" value={prog.areaTematica || ''} onChange={(v) => updateProgram('areaTematica', v)} disabled={!editable} />
        </div>
        <div className="grid g3">
          <FormField label="Unidade orçamentária responsável" value={prog.unidadeOrcamentaria} onChange={(v) => updateProgram('unidadeOrcamentaria', v)} disabled={!editable} />
          <FormField label="Órgão responsável pelo Programa" value={prog.orgao} onChange={(v) => updateProgram('orgao', v)} disabled={!editable} />
          <FormField label="Horizonte Temporal" value={prog.horizonteTemporal || ''} onChange={(v) => updateProgram('horizonteTemporal', v)} disabled={!editable} />
        </div>
        <div className="grid g3">
          <FormField label="Tipo de Programa" value={prog.tipoPrograma || ''} onChange={(v) => updateProgram('tipoPrograma', v)} disabled={!editable} />
          <FormField label="Indicador" value={prog.indicador || ''} onChange={(v) => updateProgram('indicador', v)} disabled={!editable} />
          <FormField label="Público-alvo" value={prog.publicoAlvo} onChange={(v) => updateProgram('publicoAlvo', v)} disabled={!editable} />
        </div>
        <div className="grid g2">
          <FormField label="Objetivo do Programa" textarea value={prog.objetivo} onChange={(v) => updateProgram('objetivo', v)} disabled={!editable} />
          <FormField label="Justificativa do Programa" textarea value={prog.justificativa} onChange={(v) => updateProgram('justificativa', v)} disabled={!editable} />
        </div>
      </Card>

      <Card title="Teoria do Problema / Preenchimento" scope="PROGRAMA"
        actions={<ActionButton color="green" icon={<Save size={16} />} disabled={!editable} onClick={onSave}>Salvar rascunho</ActionButton>}
        lead="Caracterização do problema público que justifica o programa.">
        <div className="grid g2">
          <FormField label="Território / abrangência" value={pt.territorio} onChange={(v) => set('territorio', v)} disabled={!editable} />
          <FormField label="Público afetado" value={pt.publicoAfetado} onChange={(v) => set('publicoAfetado', v)} disabled={!editable} />
        </div>
        <FormField label="Problema central" required textarea value={pt.problemaCentral} onChange={(v) => { set('problemaCentral', v); updateProgram('problemaCentral', v); }} disabled={!editable} />
        <div className="grid g2">
          <FormField label="Situação atual indesejada" textarea value={pt.situacaoAtual} onChange={(v) => set('situacaoAtual', v)} disabled={!editable} />
          <FormField label="Situação futura desejada" textarea value={pt.situacaoFutura} onChange={(v) => set('situacaoFutura', v)} disabled={!editable} />
        </div>
        <div className="grid g2">
          <FormField label="Evidências e fonte" textarea value={pt.evidencias} onChange={(v) => set('evidencias', v)} disabled={!editable} />
          <FormField label="Hipóteses causais / limitações externas" textarea value={pt.hipotesesCausais} onChange={(v) => set('hipotesesCausais', v)} disabled={!editable} />
        </div>
      </Card>
    </>
  );
}

// ---- Envolvidos ----
function EnvolvidosTab({ fw, editable, updateFw }: any) {
  const add = () => updateFw((f: LogicalFramework) => f.involvedActors.push({ id: uid('ia'), nome: 'Novo envolvido', papel: '', interesse: '', influencia: 'média', posicao: 'neutro' }));
  const setA = (id: string, k: string, v: string) => updateFw((f: LogicalFramework) => { const a = f.involvedActors.find((x) => x.id === id); if (a) (a as any)[k] = v; });
  const del = (id: string) => updateFw((f: LogicalFramework) => { f.involvedActors = f.involvedActors.filter((x) => x.id !== id); });
  return (
    <Card title="Análise de Envolvidos" scope="PROGRAMA" count={fw.involvedActors.length}
      actions={<ActionButton color="green" icon={<Plus size={16} />} disabled={!editable} onClick={add}>Adicionar envolvido</ActionButton>}
      lead="Atores afetados ou que influenciam o problema, com interesse, influência e posição.">
      <DataTable<InvolvedActor> empty="Nenhum envolvido cadastrado." rows={fw.involvedActors} columns={[
        { key: 'nome', header: 'Nome', render: (r) => <input value={r.nome} disabled={!editable} onChange={(e) => setA(r.id, 'nome', e.target.value)} style={cellInput} /> },
        { key: 'papel', header: 'Papel', render: (r) => <input value={r.papel} disabled={!editable} onChange={(e) => setA(r.id, 'papel', e.target.value)} style={cellInput} /> },
        { key: 'interesse', header: 'Interesse', render: (r) => <input value={r.interesse} disabled={!editable} onChange={(e) => setA(r.id, 'interesse', e.target.value)} style={cellInput} /> },
        { key: 'influencia', header: 'Influência', render: (r) => <select value={r.influencia} disabled={!editable} onChange={(e) => setA(r.id, 'influencia', e.target.value)} style={cellInput}><option>baixa</option><option>média</option><option>alta</option></select> },
        { key: 'posicao', header: 'Posição', render: (r) => <select value={r.posicao} disabled={!editable} onChange={(e) => setA(r.id, 'posicao', e.target.value)} style={cellInput}><option>apoia</option><option>neutro</option><option>resiste</option></select> },
        { key: 'acts', header: '', render: (r) => <button className="icobtn del" disabled={!editable} onClick={() => del(r.id)}><Trash2 size={14} /></button> },
      ]} />
    </Card>
  );
}

// ---- Árvores combinadas ----
function ArvoresTab({ fw, editable, updateFw, toast }: any) {
  const [text, setText] = useState('');
  const [type, setType] = useState<ProblemNodeType>('causa maior');
  const nodes: ProblemNode[] = fw.problemNodes;
  const central = nodes.find((n) => n.type === 'problema central');
  const add = () => {
    if (!text.trim()) return;
    updateFw((f: LogicalFramework) => f.problemNodes.push({
      id: uid('pn'), text: text.trim(), type, parentId: central?.id || null,
      evidence: '', isModifiable: 'parcial', isParameter: type === 'parâmetro externo', notes: '',
    }));
    setText('');
  };
  const del = (id: string) => updateFw((f: LogicalFramework) => { f.problemNodes = f.problemNodes.filter((x) => x.id !== id); });
  const gen = () => {
    updateFw((f: LogicalFramework) => { f.objectiveNodes = mockApi.generateObjectiveTree(f.problemNodes); });
    toast('Árvore de objetivos gerada a partir dos problemas.', 'ok');
  };
  const setObjectiveText = (id: string, v: string) => updateFw((f: LogicalFramework) => {
    const n = f.objectiveNodes.find((x) => x.id === id);
    if (n) n.text = v;
  });
  const tips: string[] = [];
  if (!central) tips.push('Defina o problema central para formar o tronco.');
  if (!nodes.some((n) => n.type.startsWith('causa'))) tips.push('Inclua causas para formar as raízes.');
  if (!nodes.some((n) => n.type.startsWith('consequência'))) tips.push('Inclua consequências para formar a copa seca.');

  return (
    <div className="qual-tree-layout">
      <Card title="Nós da árvore" scope="PROGRAMA"
        actions={<ActionButton color="purple" icon={<Wand2 size={16} />} disabled={!editable || nodes.length === 0} onClick={gen}>Gerar objetivos</ActionButton>}
        lead="A árvore de problemas usa folhas secas e laranjas; a árvore de objetivos usa folhas verdes.">
        <FormField label="Texto do nó" textarea value={text} onChange={setText} disabled={!editable} placeholder="Ex.: Custos de alimentação e deslocamento." />
        <SelectField label="Tipo do nó" value={type} options={PROBLEM_TYPES as string[]} onChange={(v) => setType(v as ProblemNodeType)} />
        <ActionButton color="green" icon={<Plus size={16} />} disabled={!editable} onClick={add}>Adicionar nó</ActionButton>

        <div className="compact-list">
          {nodes.map((n) => (
            <div key={n.id} className="compact-row">
              <span><b>{n.type}</b>{n.text}</span>
              <button className="icobtn del" disabled={!editable} onClick={() => del(n.id)} title="Excluir"><Trash2 size={13} /></button>
            </div>
          ))}
          {nodes.length === 0 && <div className="empty">Nenhum nó cadastrado.</div>}
        </div>

        {tips.map((t) => <div key={t} className="alert warn">{t}</div>)}
      </Card>

      <div className="tree-pair">
        <Card title={<><GitBranch size={16} /> Árvore de Problemas</>}>
          <TreeVisualizer kind="problem" problemNodes={nodes} />
        </Card>
        <Card title="Árvore de Objetivos">
          <TreeVisualizer kind="objective" objectiveNodes={fw.objectiveNodes} />
        </Card>
      </div>

      <Card title="Revisar redações positivas" count={fw.objectiveNodes.length}>
        {fw.objectiveNodes.length === 0 ? <div className="empty">Gere a árvore de objetivos para revisar os textos.</div>
          : fw.objectiveNodes.map((n: any) => (
            <div className="field" key={n.id}>
              <label>{n.type}</label>
              <input value={n.text} disabled={!editable} onChange={(e) => setObjectiveText(n.id, e.target.value)} />
            </div>
          ))}
      </Card>
    </div>
  );
}

// ---- Árvore de Problemas ----
function ArvoreProblemasTab({ fw, editable, updateFw }: any) {
  const [text, setText] = useState('');
  const [type, setType] = useState<ProblemNodeType>('causa maior');
  const nodes: ProblemNode[] = fw.problemNodes;
  const central = nodes.find((n) => n.type === 'problema central');
  const add = () => {
    if (!text.trim()) return;
    updateFw((f: LogicalFramework) => f.problemNodes.push({ id: uid('pn'), text: text.trim(), type, parentId: central?.id || null, evidence: '', isModifiable: 'parcial', isParameter: type === 'parâmetro externo', notes: '' }));
    setText('');
  };
  const del = (id: string) => updateFw((f: LogicalFramework) => { f.problemNodes = f.problemNodes.filter((x) => x.id !== id); });

  const tips: string[] = [];
  if (!central) tips.push('Defina o problema central (tronco da árvore).');
  if (!nodes.some((n) => n.type.startsWith('causa'))) tips.push('Adicione ao menos uma causa.');
  if (!nodes.some((n) => n.type.startsWith('consequência'))) tips.push('Adicione ao menos uma consequência.');

  return (
    <div className="grid" style={{ gridTemplateColumns: '320px 1fr 280px', gap: 16 }}>
      <Card title="Cadastrar nós">
        <FormField label="Texto do nó" textarea value={text} onChange={setText} disabled={!editable} placeholder="Ex.: Custos de alimentação e deslocamento." />
        <SelectField label="Tipo" value={type} options={PROBLEM_TYPES as string[]} onChange={(v) => setType(v as ProblemNodeType)} />
        <ActionButton color="green" icon={<Plus size={16} />} disabled={!editable} onClick={add}>Adicionar nó</ActionButton>
        <div style={{ marginTop: 14 }}>
          {nodes.map((n) => (
            <div key={n.id} className="kv">
              <span><span className="badge gray" style={{ marginRight: 6 }}>{n.type}</span>{n.text}</span>
              <button className="icobtn del" disabled={!editable} onClick={() => del(n.id)}><Trash2 size={13} /></button>
            </div>
          ))}
          {nodes.length === 0 && <div className="empty">Nenhum nó.</div>}
        </div>
      </Card>

      <Card title={<><GitBranch size={16} /> Visualização da árvore</>}>
        <TreeVisualizer kind="problem" problemNodes={nodes} />
      </Card>

      <Card title="Coerência e dicas">
        {tips.length === 0 ? <div className="alert ok">Estrutura mínima preenchida.</div>
          : tips.map((t, i) => <div key={i} className="alert warn">{t}</div>)}
        <p className="small muted" style={{ marginTop: 10 }}>Convenção: causas estruturais = solo; causas maiores/superficiais = raízes; problema central = tronco; consequências diretas = galhos; consequências finais = folhas.</p>
      </Card>
    </div>
  );
}

// ---- Árvore de Objetivos ----
function ArvoreObjetivosTab({ fw, editable, updateFw, toast }: any) {
  const gen = () => { updateFw((f: LogicalFramework) => { f.objectiveNodes = mockApi.generateObjectiveTree(f.problemNodes); }); toast('Árvore de objetivos gerada a partir dos problemas.', 'ok'); };
  const setText = (id: string, v: string) => updateFw((f: LogicalFramework) => { const n = f.objectiveNodes.find((x) => x.id === id); if (n) n.text = v; });
  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 320px', gap: 16 }}>
      <Card title="Visualização — Árvore de Objetivos"
        actions={<ActionButton color="purple" icon={<Wand2 size={16} />} disabled={!editable} onClick={gen}>Gerar a partir dos problemas</ActionButton>}
        lead="A árvore de objetivos é o espelho positivo da árvore de problemas: causas viram meios, consequências viram fins.">
        <TreeVisualizer kind="objective" objectiveNodes={fw.objectiveNodes} />
      </Card>
      <Card title="Revisar redações positivas">
        {fw.objectiveNodes.length === 0 ? <div className="empty">Gere a árvore para revisar os textos.</div>
          : fw.objectiveNodes.map((n: any) => (
            <div className="field" key={n.id}>
              <label>{n.type}</label>
              <input value={n.text} disabled={!editable} onChange={(e) => setText(n.id, e.target.value)} />
            </div>
          ))}
      </Card>
    </div>
  );
}

// ---- Alternativas + matriz de decisão ----
function AlternativasTab({ fw, prog, editable, updateFw, toast }: any) {
  const add = () => updateFw((f: LogicalFramework) => f.alternatives.push({ id: uid('alt'), meio: '', acaoPossivel: 'Nova alternativa', produtoPossivel: '', atividadeAssociada: '', custo: 'médio', tempoImplementacao: '', capacidadeOperacional: '', impactoPotencial: '', viabilidade: '', aderenciaPpag: '', observacoes: '', scores: {} }));
  const setAlt = (id: string, k: string, v: any) => updateFw((f: LogicalFramework) => { const a = f.alternatives.find((x) => x.id === id); if (a) (a as any)[k] = v; });
  const setScore = (id: string, cid: string, v: number) => updateFw((f: LogicalFramework) => { const a = f.alternatives.find((x) => x.id === id); if (a) a.scores[cid] = v; });
  const del = (id: string) => updateFw((f: LogicalFramework) => { f.alternatives = f.alternatives.filter((x) => x.id !== id); });
  const select = (id: string) => updateFw((f: LogicalFramework) => { f.selectedAlternativeId = id; });
  const totalOf = (a: Alternative) => fw.criteria.reduce((s: number, c: any) => s + (a.scores[c.id] || 0) * c.peso, 0);

  return (
    <>
      <Card title="Alternativas de intervenção" count={fw.alternatives.length}
        actions={<ActionButton color="green" icon={<Plus size={16} />} disabled={!editable} onClick={add}>Adicionar alternativa</ActionButton>}
        lead="Construídas a partir dos meios da árvore de objetivos.">
        <DataTable<Alternative> empty="Nenhuma alternativa." rows={fw.alternatives} columns={[
          { key: 'acaoPossivel', header: 'Ação possível', render: (r) => <input value={r.acaoPossivel} disabled={!editable} onChange={(e) => setAlt(r.id, 'acaoPossivel', e.target.value)} style={cellInput} /> },
          { key: 'produtoPossivel', header: 'Produto', render: (r) => <input value={r.produtoPossivel} disabled={!editable} onChange={(e) => setAlt(r.id, 'produtoPossivel', e.target.value)} style={cellInput} /> },
          { key: 'custo', header: 'Custo', render: (r) => <select value={r.custo} disabled={!editable} onChange={(e) => setAlt(r.id, 'custo', e.target.value)} style={cellInput}><option>baixo</option><option>médio</option><option>alto</option></select> },
          { key: 'impactoPotencial', header: 'Impacto', render: (r) => <input value={r.impactoPotencial} disabled={!editable} onChange={(e) => setAlt(r.id, 'impactoPotencial', e.target.value)} style={cellInput} /> },
          { key: 'aderenciaPpag', header: 'Aderência PPAG', render: (r) => <input value={r.aderenciaPpag} disabled={!editable} onChange={(e) => setAlt(r.id, 'aderenciaPpag', e.target.value)} style={cellInput} /> },
          { key: 'acts', header: '', render: (r) => <button className="icobtn del" disabled={!editable} onClick={() => del(r.id)}><Trash2 size={14} /></button> },
        ]} />
      </Card>

      <Card title="Matriz de decisão" lead="Notas de 1 a 5 por critério (ponderadas pelo peso). A alternativa de maior pontuação é destacada.">
        <div className="table-wrap">
          <table className="dt">
            <thead><tr><th>Alternativa</th>{fw.criteria.map((c: any) => <th key={c.id} className="num">{c.nome} (peso {c.peso})</th>)}<th className="num">Total</th><th>Selecionada</th></tr></thead>
            <tbody>
              {fw.alternatives.map((a: Alternative) => (
                <tr key={a.id} style={fw.selectedAlternativeId === a.id ? { background: '#e7f5ee' } : undefined}>
                  <td>{a.acaoPossivel || '—'}</td>
                  {fw.criteria.map((c: any) => (
                    <td key={c.id} className="num">
                      <select value={a.scores[c.id] || ''} disabled={!editable} onChange={(e) => setScore(a.id, c.id, Number(e.target.value))} style={{ width: 56, ...cellInput }}>
                        <option value="">–</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                  ))}
                  <td className="num"><b>{totalOf(a)}</b></td>
                  <td><ActionButton color={fw.selectedAlternativeId === a.id ? 'green' : 'ghost'} sm disabled={!editable} onClick={() => select(a.id)}>{fw.selectedAlternativeId === a.id ? 'Selecionada' : 'Selecionar'}</ActionButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <SinteseTab fw={fw} prog={prog} updateFw={updateFw} toast={toast} onGoMapa={() => {}} />
    </>
  );
}

// ---- Síntese ----
function SinteseTab({ fw, prog, updateFw, toast, onGoMapa }: any) {
  const pt = fw.problemTheory;
  const filled = [pt.problemaCentral, pt.publicoAfetado, pt.evidencias, pt.justificativa, pt.situacaoFutura].filter((x: string) => x && x.trim()).length;
  const treeOk = (fw.problemNodes.length >= 3 ? 1 : 0) + (fw.objectiveNodes.length >= 1 ? 1 : 0) + (fw.selectedAlternativeId ? 1 : 0);
  const score = Math.round(((filled / 5) * 60) + ((treeOk / 3) * 40));
  const sel = fw.alternatives.find((a: Alternative) => a.id === fw.selectedAlternativeId);
  const objCentral = fw.objectiveNodes.find((n: any) => n.type === 'objetivo central');
  const meios = fw.objectiveNodes.filter((n: any) => n.type === 'meio').map((n: any) => n.text);
  const fins = fw.objectiveNodes.filter((n: any) => n.type === 'fim').map((n: any) => n.text);

  return (
    <>
      <Card title="Síntese do Marco Lógico">
        <CoherenceScore value={score} label="Coerência do preenchimento (0–100)" sub="Considera teoria do problema, árvores e alternativa selecionada." />
      </Card>
      <div className="tree-pair synthesis-trees">
        <Card title="Árvore de Problemas">
          <TreeVisualizer kind="problem" problemNodes={fw.problemNodes} />
        </Card>
        <Card title="Árvore de Objetivos">
          <TreeVisualizer kind="objective" objectiveNodes={fw.objectiveNodes} />
        </Card>
      </div>
      <div className="grid g2">
        <Card title="Resumo">
          <div className="kv"><span>Problema central</span><span className="v" style={{ maxWidth: 340, textAlign: 'right' }}>{pt.problemaCentral || '—'}</span></div>
          <div className="kv"><span>Objetivo central</span><span className="v" style={{ maxWidth: 340, textAlign: 'right' }}>{objCentral?.text || prog.objetivo || '—'}</span></div>
          <div className="kv"><span>Principais meios</span><span className="v" style={{ maxWidth: 340, textAlign: 'right' }}>{meios.slice(0, 3).join('; ') || '—'}</span></div>
          <div className="kv"><span>Principais fins</span><span className="v" style={{ maxWidth: 340, textAlign: 'right' }}>{fins.slice(0, 3).join('; ') || '—'}</span></div>
          <div className="kv"><span>Alternativa selecionada</span><span className="v">{sel?.acaoPossivel || '—'}</span></div>
          <div className="kv"><span>Parâmetros / riscos</span><span className="v" style={{ maxWidth: 340, textAlign: 'right' }}>{pt.limitacoesExternas || '—'}</span></div>
        </Card>
        <Card title="Sugestões para o programa e ações">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            <li>Use o objetivo central como base do objetivo do programa.</li>
            <li>Transforme os meios em ações e recursos no Mapa de Processos.</li>
            <li>Transforme os fins em resultados e impactos.</li>
            <li>Verifique se a alternativa selecionada tem aderência ao PPAG.</li>
          </ul>
          <div style={{ marginTop: 14 }}>
            <ActionButton color="blue" icon={<ArrowRight size={16} />} onClick={() => { updateFw((f: LogicalFramework) => { f.synthesis = `Objetivo: ${objCentral?.text || prog.objetivo}`; }); toast('Síntese salva. Próximo passo: Mapa de Processos e Resultados.', 'ok'); onGoMapa(); }}>
              Salvar síntese
            </ActionButton>
          </div>
        </Card>
      </div>
    </>
  );
}

const cellInput: React.CSSProperties = { border: '1px solid #d4dde3', borderRadius: 7, padding: '5px 7px', fontSize: 12, width: '100%', minWidth: 90 };
