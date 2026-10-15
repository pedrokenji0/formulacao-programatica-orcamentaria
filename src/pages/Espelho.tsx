import { useState } from 'react';
import { useApp } from '../store/AppStore';
import { Card, Tabs, ActionButton, FormField, SelectField, useToast, brl, uid } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { MirrorForm, type MirrorFieldDef } from '../components/MirrorForm';
import type { ActionMirror, IndicatorMirror, ProgramMirror } from '../types';
import { Download, Upload, Plus, Wand2, FileJson, FileSpreadsheet } from 'lucide-react';

export function EspelhoPage({ initialTab }: { initialTab?: string }) {
  const { state, update, can } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState(initialTab || 'programa');
  const pid = state.currentProgramId;
  const prog = state.programs.find((p) => p.id === pid)!;
  const map = state.maps.find((m) => m.programId === pid);
  let mirror = state.mirrors.find((m) => m.programId === pid);
  const editable = can('editMapa') || can('saveRascunho');

  const ensureMirror = () => update((s) => {
    if (!s.mirrors.find((m) => m.programId === pid)) {
      const p = s.programs.find((x) => x.id === pid)!;
      s.mirrors.push({ programId: pid, programMirror: { codigo: p.codigo, nome: p.nome, unidadeResponsavel: p.unidadeOrcamentaria, objetivo: p.objetivo, justificativa: p.justificativa, publicoAlvo: p.publicoAlvo, problema: p.problemaCentral, diretrizes: '', resultados: p.resultados.join('; '), impactos: p.impactos.join('; '), indicadores: '', observacoes: '' }, actionMirrors: [], indicatorMirrors: [] });
    }
  });
  if (!mirror) { mirror = { programId: pid, programMirror: { codigo: prog.codigo, nome: prog.nome, unidadeResponsavel: prog.unidadeOrcamentaria, objetivo: prog.objetivo, justificativa: prog.justificativa, publicoAlvo: prog.publicoAlvo, problema: prog.problemaCentral, diretrizes: '', resultados: prog.resultados.join('; '), impactos: prog.impactos.join('; '), indicadores: '', observacoes: '' }, actionMirrors: [], indicatorMirrors: [] }; }

  const tabs = [
    { id: 'programa', label: 'Simulação · Programa' },
    { id: 'acao', label: 'Simulação · Ação' },
    { id: 'indicador', label: 'Simulação · Indicador' },
    { id: 'export', label: 'Exportar / Importar' },
  ];

  return (
    <>
      <PageHeader crumb="Espelho para Planejamento" title="Espelho para Planejamento"
        sub="Simula os campos que seriam preenchidos no sistema oficial (PPO). Pré-preenchidos a partir do Marco Lógico e do Mapa." />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'programa' && <ProgramaMirrorTab mirror={mirror} prog={prog} map={map} editable={editable} ensureMirror={ensureMirror} pid={pid} />}
      {tab === 'acao' && <AcaoMirrorTab pid={pid} />}
      {tab === 'indicador' && <IndicadorMirrorTab pid={pid} map={map} />}
      {tab === 'export' && <ExportTab />}
    </>
  );
}

function ProgramaMirrorTab({ mirror, prog, map, editable, ensureMirror, pid }: any) {
  const { update } = useApp(); const toast = useToast();
  const pm: ProgramMirror = mirror.programMirror;
  const set = (k: string, v: string) => { ensureMirror(); update((s: any) => { const m = s.mirrors.find((x: any) => x.programId === pid); (m.programMirror as any)[k] = v; }); };
  const autofill = () => { ensureMirror(); update((s: any) => { const m = s.mirrors.find((x: any) => x.programId === pid); const mp = s.maps.find((x: any) => x.programId === pid); Object.assign(m.programMirror, { unidadeAdministrativa: prog.unidadeAdministrativa || '', orgaoResponsavel: prog.orgao, areaTematica: prog.areaTematica || '', objetivo: prog.objetivo, problema: prog.problemaCentral, publicoAlvo: prog.publicoAlvo, horizonteTemporal: prog.horizonteTemporal || '', tipoPrograma: prog.tipoPrograma || '', resultados: (mp?.resultados || []).map((r: any) => r.texto).join('; '), impactos: (mp?.impactos || []).map((i: any) => i.texto).join('; '), indicadores: prog.indicador || m.programMirror.indicadores }); }); toast('Campos preenchidos a partir do programa e do mapa.', 'ok'); };
  const defs: MirrorFieldDef[] = [
    { key: 'codigo', label: 'Código do programa' }, { key: 'nome', label: 'Nome do programa' },
    { key: 'unidadeAdministrativa', label: 'Unidade Administrativa' },
    { key: 'unidadeResponsavel', label: 'Unidade responsável', full: true },
    { key: 'orgaoResponsavel', label: 'Órgão responsável pelo Programa' },
    { key: 'areaTematica', label: 'Área Temática' },
    { key: 'objetivo', label: 'Objetivo', textarea: true, full: true }, { key: 'justificativa', label: 'Justificativa', textarea: true, full: true },
    { key: 'publicoAlvo', label: 'Público-alvo', textarea: true }, { key: 'problema', label: 'Problema a enfrentar', textarea: true },
    { key: 'horizonteTemporal', label: 'Horizonte Temporal' }, { key: 'tipoPrograma', label: 'Tipo de Programa' },
    { key: 'diretrizes', label: 'Diretrizes relacionadas', textarea: true }, { key: 'resultados', label: 'Resultados esperados', textarea: true },
    { key: 'impactos', label: 'Impactos esperados', textarea: true }, { key: 'indicadores', label: 'Indicadores sugeridos', textarea: true },
    { key: 'observacoes', label: 'Observações', textarea: true, full: true },
  ];
  return (
    <Card title="Simulação de Preenchimento do Programa"
      actions={<ActionButton color="purple" icon={<Wand2 size={16} />} disabled={!editable} onClick={autofill}>Preencher do ML + Mapa</ActionButton>}>
      <MirrorForm defs={defs} value={pm} onChange={set} />
    </Card>
  );
}

function AcaoMirrorTab({ pid }: { pid: string }) {
  const { state } = useApp();
  const prog = state.programs.find((p) => p.id === pid);
  const actions = state.actions.filter((a) => a.programaId === pid);
  const [selId, setSelId] = useState(actions[0]?.id || '');
  const a = actions.find((x) => x.id === selId) || actions[0];
  if (!a) return <Card title="Simulação · Ação"><div className="empty">Nenhuma ação neste programa.</div></Card>;
  const obz = state.budgetItems.filter((item) => item.programaId === pid && item.actionId === a.id);
  const valorObz = obz.reduce((s, b) => s + b.valorTotal, 0);
  const am: ActionMirror = {
    codigoPrograma: prog?.codigo, programaNome: prog?.nome, codigo: a.codigo, nome: a.nome, unidadeAdministrativa: (prog as any)?.unidadeAdministrativa || '',
    unidadeOrcamentaria: a.unidadeOrcamentaria, codigoUnidadeOrcamentaria: a.unidadeOrcamentaria.match(/^\s*([\w.]+)/)?.[1] || '',
    orgao: a.orgao, codigoOrgao: a.orgao.match(/^\s*([\w.]+)/)?.[1] || '', funcao: a.funcao, subfuncao: a.subfuncao,
    tipoAcao: a.tipoAcao, iag: a.iag, publicoAlvo: a.publicoAlvo, relacaoMulher: '', produto: a.produto, especificacaoProduto: a.especificacaoProduto,
    unidadeMedida: a.unidadeMedida, finalidade: a.finalidade, descricao: a.descricao, baseLegal: a.baseLegal, regionalizacao: '', valorTotalObz: valorObz, itensObz: obz.length,
  };
  const kv = (k: string, v: any) => <div className="kv"><span>{k}</span><span className="v" style={{ maxWidth: 520, textAlign: 'right' }}>{v || '—'}</span></div>;
  return (
    <Card title="Simulação de Preenchimento da Ação"
      actions={<select value={selId} onChange={(e) => setSelId(e.target.value)} style={{ border: '1px solid #ccd6dc', borderRadius: 8, padding: '7px 10px' }}>{actions.map((x) => <option key={x.id} value={x.id}>{x.codigo} — {x.nome.slice(0, 30)}</option>)}</select>}
      lead="Campos inspirados no PPO, com itens OBZ vinculados e valor total da ação.">
      <div className="grid g2">
        <div className="mirror-section">
          <h3>Campos travados após criação</h3>
          {kv('Código do Programa', am.codigoPrograma)} {kv('Programa', am.programaNome)}
          {kv('Código da Ação', am.codigo)} {kv('Unidade Orçamentária Responsável', am.unidadeOrcamentaria)}
          {kv('Código UO', am.codigoUnidadeOrcamentaria)} {kv('Órgão responsável pela Ação', am.orgao)}
          {kv('Código Órgão', am.codigoOrgao)} {kv('Tipo de Ação', am.tipoAcao)}
        </div>
        <div className="mirror-section">
          <h3>Campos alteráveis / preenchíveis</h3>
          {kv('Ação (nome)', am.nome)} {kv('Unidade Administrativa', am.unidadeAdministrativa)}
          {kv('Função', am.funcao)} {kv('Subfunção', am.subfuncao)} {kv('IAG', am.iag)}
          {kv('Público-alvo', am.publicoAlvo)} {kv('Relação com política de atendimento à mulher vítima de violência', am.relacaoMulher || 'Não informado')}
          {kv('Produto', am.produto)} {kv('Especificação do produto', am.especificacaoProduto)}
          {kv('Unidade de medida', am.unidadeMedida)} {kv('Finalidade', am.finalidade)}
          {kv('Base legal', am.baseLegal)}
          {kv('Itens OBZ vinculados', am.itensObz)} {kv('Valor total OBZ da ação', brl(am.valorTotalObz))}
        </div>
      </div>
      <FormField label="Descrição" textarea value={am.descricao} disabled />
      <div className="alert ok" style={{ marginTop: 8 }}>Coerência: {am.itensObz > 0 ? `${am.itensObz} itens OBZ associados a esta ação.` : 'Nenhum item OBZ associado a esta ação.'}</div>
    </Card>
  );
}

function IndicadorMirrorTab({ pid, map }: { pid: string; map: any }) {
  const { state, update } = useApp(); const toast = useToast();
  const mirror = state.mirrors.find((m) => m.programId === pid);
  const inds = mirror?.indicatorMirrors || [];
  const suggest = () => {
    update((s) => {
      const m = s.mirrors.find((x) => x.programId === pid); if (!m) return;
      const mp = s.maps.find((x) => x.programId === pid);
      for (const r of (mp?.resultados || [])) {
        if (!m.indicatorMirrors.some((i) => i.resultadoVinculado === r.texto)) {
          m.indicatorMirrors.push({ id: uid('ind'), nome: 'Indicador de: ' + r.texto.slice(0, 40), programaVinculado: s.programs.find((p) => p.id === pid)!.codigo, resultadoVinculado: r.texto, descricao: '', formula: 'Soma de beneficiários no período', unidadeMedida: 'PESSOA', polaridade: 'Quanto maior, melhor', periodicidade: 'Anual', fonteDados: 'Registros administrativos da ação', linhaBase: '', meta: '', observacoesMetodologicas: '', limitacoes: '' });
        }
      }
    });
    toast('Indicadores sugeridos a partir dos resultados.', 'ok');
  };
  const set = (id: string, k: string, v: string) => update((s) => { const m = s.mirrors.find((x) => x.programId === pid); const ind = m?.indicatorMirrors.find((i) => i.id === id); if (ind) (ind as any)[k] = v; });
  return (
    <Card title="Simulação de Preenchimento do Indicador" count={inds.length}
      actions={<ActionButton color="purple" icon={<Wand2 size={16} />} onClick={suggest}>Sugerir a partir dos resultados</ActionButton>}>
      {inds.length === 0 && <div className="empty">Nenhum indicador. Use “Sugerir a partir dos resultados”.</div>}
      {inds.map((ind: IndicatorMirror) => (
        <div key={ind.id} className="card" style={{ background: '#fbfdfe' }}>
          <div className="grid g2">
            <FormField label="Nome do indicador" value={ind.nome} onChange={(v) => set(ind.id, 'nome', v)} />
            <FormField label="Resultado vinculado" value={ind.resultadoVinculado} onChange={(v) => set(ind.id, 'resultadoVinculado', v)} />
            <FormField label="Fórmula de cálculo" value={ind.formula} onChange={(v) => set(ind.id, 'formula', v)} />
            <SelectField label="Unidade de medida" value={ind.unidadeMedida} options={state.lists.unidadesMedida} onChange={(v) => set(ind.id, 'unidadeMedida', v)} />
            <SelectField label="Polaridade" value={ind.polaridade} options={state.lists.polaridades} onChange={(v) => set(ind.id, 'polaridade', v)} />
            <SelectField label="Periodicidade" value={ind.periodicidade} options={state.lists.periodicidades} onChange={(v) => set(ind.id, 'periodicidade', v)} />
            <FormField label="Fonte de dados" value={ind.fonteDados} onChange={(v) => set(ind.id, 'fonteDados', v)} />
            <FormField label="Linha de base" value={ind.linhaBase} onChange={(v) => set(ind.id, 'linhaBase', v)} />
            <FormField label="Meta" value={ind.meta} onChange={(v) => set(ind.id, 'meta', v)} />
          </div>
        </div>
      ))}
    </Card>
  );
}

function ExportTab() {
  const { state, exportState, importState, reset } = useApp(); const toast = useToast();
  const pid = state.currentProgramId;
  const download = (name: string, content: string, type = 'application/json') => {
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };
  const exportCsv = () => {
    const items = state.budgetItems.filter((b) => b.programaId === pid);
    const head = ['acao', 'grupo', 'elementoItem', 'agrupamento', 'fonte', 'descricao', 'volume', 'precoUnitario', 'frequencia', 'valorTotal', 'cenario', 'pN3', 'pN2', 'pN1'];
    const rows = items.map((b) => [b.acaoLabel, b.grupo, b.elementoItem, b.agrupamento, b.fonte, b.descricao, b.volume, b.precoUnitario, b.frequenciaPagamento, b.valorTotal, b.classificacaoCenario, b.prioridadeN3, b.prioridadeN2, b.prioridadeN1].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    download('espelho-obz.csv', [head.join(','), ...rows].join('\n'), 'text/csv');
  };
  const importJson = (file: File) => { const r = new FileReader(); r.onload = (e) => { if (importState(String(e.target?.result))) toast('Estado importado.', 'ok'); else toast('JSON inválido.', 'err'); }; r.readAsText(file); };
  const mirror = state.mirrors.find((m) => m.programId === pid);
  return (
    <>
      <Card title="Exportar" lead="Baixe o espelho do programa/ação/indicador, o pacote completo ou um CSV simplificado.">
        <div className="row">
          <ActionButton color="purple" icon={<FileJson size={16} />} onClick={() => download('espelho-programa.json', JSON.stringify(mirror?.programMirror, null, 2))}>Espelho do Programa</ActionButton>
          <ActionButton color="purple" icon={<FileJson size={16} />} onClick={() => download('espelho-acoes.json', JSON.stringify(state.actions.filter((a) => a.programaId === pid), null, 2))}>Espelho das Ações</ActionButton>
          <ActionButton color="purple" icon={<FileJson size={16} />} onClick={() => download('espelho-indicadores.json', JSON.stringify(mirror?.indicatorMirrors, null, 2))}>Espelho dos Indicadores</ActionButton>
          <ActionButton color="blue" icon={<Download size={16} />} onClick={() => download('pacote-completo.json', exportState())}>Pacote completo (JSON)</ActionButton>
          <ActionButton color="green" icon={<FileSpreadsheet size={16} />} onClick={exportCsv}>CSV simplificado (OBZ)</ActionButton>
        </div>
      </Card>
      <Card title="Importar" lead="Restaure um pacote JSON exportado anteriormente. Útil para trabalhar antes da abertura do ciclo oficial.">
        <div className="row">
          <label className="btn purple" style={{ cursor: 'pointer' }}><Upload size={16} /> Importar pacote JSON
            <input type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} /></label>
          <ActionButton color="red" onClick={() => { if (confirm('Restaurar dados de exemplo? As alterações locais serão perdidas.')) { reset(); toast('Estado restaurado para o exemplo.'); } }}>Restaurar exemplo</ActionButton>
        </div>
      </Card>
    </>
  );
}
