import { useState } from 'react';
import { useApp, PERMS, type Permission } from '../store/AppStore';
import { Card, Tabs, ActionButton, useToast, uid } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import type { Action, BudgetItemOBZ, Program, SupportList, Perfil } from '../types';
import { Plus, Trash2, Power, Download, Upload, History, Database } from 'lucide-react';

const PERFIS: Perfil[] = ['Leitor', 'Gestor UA', 'Gestor Setorial', 'Central Geral', 'Consulta', 'Técnico do Órgão', 'Validador do Órgão', 'DCMEFO/SEPLAG', 'Administrador'];
const PERM_LABELS: { key: Permission; label: string }[] = [
  { key: 'editMarcoLogico', label: 'Editar Marco Lógico' }, { key: 'editMapa', label: 'Editar Mapa' },
  { key: 'editObz', label: 'Editar OBZ' }, { key: 'editLinks', label: 'Editar associações' },
  { key: 'enviarValidacao', label: 'Enviar p/ validação' }, { key: 'validarOrgao', label: 'Validar (órgão)' },
  { key: 'validarDcmefo', label: 'Validar (DCMEFO)' }, { key: 'devolver', label: 'Devolver' },
  { key: 'bloquear', label: 'Bloquear' }, { key: 'adminTabelas', label: 'Administrar tabelas' }, { key: 'exportar', label: 'Exportar' },
];

export function AdminPage() {
  const { can } = useApp();
  const [tab, setTab] = useState('programatica');
  if (!can('adminTabelas')) return <Card title="Acesso restrito"><div className="empty">Esta área é exclusiva do perfil Administrador. Troque o perfil no topo.</div></Card>;
  const tabs = [
    { id: 'programatica', label: 'Tabelas · Programática' },
    { id: 'orcamentaria', label: 'Tabelas · Orçamentária' },
    { id: 'perfis', label: 'Perfis e Permissões' },
    { id: 'bases', label: 'Bases CSV' },
    { id: 'importexport', label: 'Importar / Exportar' },
    { id: 'governanca', label: 'Governança' },
  ];
  return (
    <>
      <PageHeader crumb="Configurações e Tabelas de Apoio" title="Administração" showProgram={false}
        sub="Manutenção das tabelas de apoio, perfis e governança. Alterações refletem nos seletores de todos os módulos." />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'programatica' && <TablesTab which="programmatic" />}
      {tab === 'orcamentaria' && <TablesTab which="budgetary" />}
      {tab === 'perfis' && <PerfisTab />}
      {tab === 'bases' && <BasesCsvTab />}
      {tab === 'importexport' && <ImportExportTab />}
      {tab === 'governanca' && <GovernancaTab />}
    </>
  );
}

function BasesCsvTab() {
  const { update } = useApp();
  const toast = useToast();
  const [log, setLog] = useState<string[]>([]);

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const entries: { name: string; rows: Record<string, string>[] }[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      entries.push({ name: file.name.toLowerCase(), rows: parseCsv(text) });
    }
    const messages: string[] = [];
    update((s) => {
      const addList = (key: keyof typeof s.lists, value: string) => {
        value = value.trim();
        if (value && !(s.lists[key] as string[]).includes(value)) (s.lists[key] as string[]).push(value);
      };
      const touchSupport = (which: 'programmatic' | 'budgetary', id: string, nome: string, values: string[]) => {
        let list = s.support[which].find((x) => x.id === id);
        if (!list) {
          list = { id, nome, valores: [], ultimaAlteracao: today(), responsavel: 'Administrador' };
          s.support[which].push(list);
        }
        for (const label of values) {
          if (label && !list.valores.some((v) => v.label === label)) list.valores.push({ id: uid('v'), label, ativo: true });
        }
        list.ultimaAlteracao = today();
      };

      for (const entry of entries) {
        const rows = entry.rows;
        if (entry.name.includes('grupos_despesa')) {
          const values = rows.map(labelCodigoNome);
          values.forEach((v) => addList('grupos', v));
          touchSupport('budgetary', 'grupo', 'Grupos de despesa', values);
          messages.push(`${rows.length} grupos de despesa`);
        } else if (entry.name.includes('elementos_itens')) {
          const values = rows.map(labelCodigoNome);
          values.forEach((v) => addList('elementosItens', v));
          touchSupport('budgetary', 'elemento-item', 'Elementos-itens', values);
          messages.push(`${rows.length} elementos-itens`);
        } else if (entry.name.includes('agrupamentos')) {
          const values = rows.map((r) => r.nome || r.agrupamento || labelCodigoNome(r));
          values.forEach((v) => addList('agrupamentos', v));
          touchSupport('budgetary', 'agrupamento', 'Agrupamentos', values);
          messages.push(`${rows.length} agrupamentos`);
        } else if (entry.name.includes('fontes')) {
          const values = rows.map((r) => r.nome ? `${r.codigo || ''}${r.codigo ? ' - ' : ''}${r.nome}` : labelCodigoNome(r));
          values.forEach((v) => addList('fontes', v));
          touchSupport('budgetary', 'fonte', 'Fontes', values);
          messages.push(`${rows.length} fontes`);
        } else if (entry.name.includes('funcoes')) {
          const values = rows.map(labelCodigoNome);
          values.forEach((v) => addList('funcoes', v));
          touchSupport('budgetary', 'funcao', 'Funções', values);
          messages.push(`${rows.length} funções`);
        } else if (entry.name.includes('subfuncoes')) {
          const values = rows.map(labelCodigoNome);
          values.forEach((v) => addList('subfuncoes', v));
          touchSupport('budgetary', 'subfuncao', 'Subfunções', values);
          messages.push(`${rows.length} subfunções`);
        } else if (entry.name.includes('unidades_orcamentarias')) {
          const values = rows.map((r) => `${r.codigo || ''}${r.codigo ? ' - ' : ''}${r.nome || r.unidade_orcamentaria || ''}`.trim());
          values.forEach((v) => addList('unidades', v));
          touchSupport('budgetary', 'uo', 'Unidades orçamentárias', values);
          messages.push(`${rows.length} unidades orçamentárias`);
        } else if (entry.name.includes('programas')) {
          for (const r of rows) upsertProgramFromCsv(s.programs, r);
          rows.map((r) => `${r.codigo || ''} - ${r.programa || r.nome || ''}`.trim()).forEach((v) => addList('programas', v));
          messages.push(`${rows.length} programas`);
        } else if (entry.name.includes('acoes')) {
          for (const r of rows) upsertActionFromCsv(s.programs, s.actions, r);
          rows.map((r) => `${r.codigo_acao || r.codigo || ''} - ${r.acao || r.nome || ''}`.trim()).forEach((v) => addList('acoes', v));
          messages.push(`${rows.length} ações`);
        } else if (entry.name.includes('base_obz') || entry.name.includes('obz')) {
          for (const r of rows) {
            const item = obzFromCsv(s.programs, s.actions, r);
            if (item) s.budgetItems.push(item);
            [item?.grupo].filter(Boolean).forEach((v) => addList('grupos', v!));
            [item?.elementoItem].filter(Boolean).forEach((v) => addList('elementosItens', v!));
            [item?.agrupamento].filter(Boolean).forEach((v) => addList('agrupamentos', v!));
            [item?.fonte].filter(Boolean).forEach((v) => addList('fontes', v!));
            [item?.unidadeOrcamentaria].filter(Boolean).forEach((v) => addList('unidades', v!));
            [item?.acaoLabel].filter(Boolean).forEach((v) => addList('acoes', v!));
          }
          messages.push(`${rows.length} itens OBZ`);
        } else if (entry.name.includes('localizadores')) {
          touchSupport('programmatic', 'localizadores', 'Localizadores', rows.map((r) => `${r.codigo_localizador || r.codigo || ''} - ${r.localizador || r.nome || ''}`.trim()));
          messages.push(`${rows.length} localizadores`);
        }
      }
    });
    setLog(messages.length ? messages : ['Nenhum arquivo reconhecido. Confira os nomes indicados em bases_csv/README.md.']);
    toast('Bases CSV processadas.', 'ok');
  };

  return (
    <>
      <Card title="Importar CSVs da pasta bases_csv"
        lead="Selecione os arquivos CSV reais das subpastas classificador_despesa, obz ou planejamento. O protótipo aplica os dados nas listas e cadastros em memória/localStorage.">
        <div className="row">
          <label className="btn purple" style={{ cursor: 'pointer' }}><Database size={16} /> Selecionar CSVs
            <input type="file" accept=".csv,text/csv" multiple hidden onChange={(e) => importFiles(e.target.files)} /></label>
          <span className="small muted">Nomes esperados: grupos_despesa, elementos_itens_despesa, agrupamentos_despesa, fontes_recursos, funcoes, subfuncoes, programas, acoes, localizadores, unidades_orcamentarias.</span>
        </div>
      </Card>
      <Card title="Resultado da importação">
        {log.length ? <ul className="import-log">{log.map((m) => <li key={m}>{m}</li>)}</ul> : <div className="empty">Nenhuma importação nesta sessão.</div>}
      </Card>
    </>
  );
}

function today() { return new Date().toISOString().slice(0, 10); }
function normalizeHeader(h: string) {
  return h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function parseCsv(text: string): Record<string, string>[] {
  const delimiter = (text.split('\n')[0].match(/;/g)?.length || 0) > (text.split('\n')[0].match(/,/g)?.length || 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quote && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quote = !quote;
    else if (ch === delimiter && !quote) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quote) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); if (row.some((v) => v.trim())) rows.push(row); }
  const headers = (rows.shift() || []).map(normalizeHeader);
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] || '').trim()])));
}
function labelCodigoNome(r: Record<string, string>) {
  const codigo = r.codigo || r.cod || r.id || '';
  const nome = r.nome || r.descricao || r.label || '';
  return `${codigo}${codigo && nome ? ' - ' : ''}${nome}`.trim();
}
function upsertProgramFromCsv(programs: Program[], r: Record<string, string>) {
  const codigo = r.codigo || r.codigo_programa || '';
  const existing = programs.find((p) => p.codigo === codigo) || programs.find((p) => p.nome === (r.programa || r.nome));
  const target = existing || {
    id: uid('prog'), codigo, nome: r.programa || r.nome || 'Programa importado',
    unidadeOrcamentaria: '', orgao: '', problemaCentral: '', objetivo: '', justificativa: '', publicoAlvo: '',
    contexto: '', resultados: [], impactos: [], status: 'RASCUNHO' as const,
  };
  target.codigo = codigo || target.codigo;
  target.nome = r.programa || r.nome || target.nome;
  target.unidadeAdministrativa = r.unidade_administrativa || target.unidadeAdministrativa || '';
  target.unidadeOrcamentaria = r.unidade_orcamentaria_responsavel || r.unidade_responsavel || target.unidadeOrcamentaria;
  target.orgao = r.orgao_responsavel || target.orgao;
  target.areaTematica = r.area_tematica || target.areaTematica || '';
  target.objetivo = r.objetivo || target.objetivo;
  target.justificativa = r.justificativa || target.justificativa;
  target.horizonteTemporal = r.horizonte_temporal || target.horizonteTemporal || '';
  target.tipoPrograma = r.tipo_programa || target.tipoPrograma || '';
  target.indicador = r.indicador || target.indicador || '';
  if (!existing) programs.push(target);
}
function upsertActionFromCsv(programs: Program[], actions: Action[], r: Record<string, string>) {
  const codigoPrograma = r.codigo_programa || '';
  let program = programs.find((p) => p.codigo === codigoPrograma);
  if (!program) {
    program = {
      id: uid('prog'), codigo: codigoPrograma, nome: r.programa || 'Programa importado',
      unidadeOrcamentaria: r.unidade_orcamentaria_responsavel || '', orgao: r.orgao_responsavel || '',
      problemaCentral: '', objetivo: '', justificativa: '', publicoAlvo: '', contexto: '',
      resultados: [], impactos: [], status: 'RASCUNHO',
    };
    programs.push(program);
  }
  const codigo = r.codigo_acao || r.codigo || '';
  const existing = actions.find((a) => a.programaId === program!.id && a.codigo === codigo);
  const target = existing || {
    id: uid('act'), programaId: program.id, codigo, nome: r.acao || r.nome || 'Ação importada',
    unidadeOrcamentaria: '', orgao: '', funcao: '', subfuncao: '', tipoAcao: '', iag: '',
    publicoAlvo: '', produto: '', especificacaoProduto: '', unidadeMedida: '', finalidade: '',
    descricao: '', baseLegal: '', status: 'RASCUNHO' as const,
  };
  Object.assign(target, {
    codigo: codigo || target.codigo,
    nome: r.acao || r.nome || target.nome,
    unidadeAdministrativa: r.unidade_administrativa || target.unidadeAdministrativa || '',
    unidadeOrcamentaria: r.unidade_orcamentaria_responsavel || target.unidadeOrcamentaria,
    codigoUnidadeOrcamentaria: r.codigo_uo || target.codigoUnidadeOrcamentaria || '',
    orgao: r.orgao_responsavel || target.orgao,
    codigoOrgao: r.codigo_orgao || target.codigoOrgao || '',
    funcao: r.funcao || target.funcao,
    subfuncao: r.subfuncao || target.subfuncao,
    tipoAcao: r.tipo_acao || target.tipoAcao,
    iag: r.iag || target.iag,
    publicoAlvo: r.publico_alvo || target.publicoAlvo,
    relacaoMulher: r.relacao_mulher || target.relacaoMulher || '',
    produto: r.produto || target.produto,
    especificacaoProduto: r.especificacao_produto || target.especificacaoProduto,
    codigoProduto: r.codigo_produto || target.codigoProduto || '',
    unidadeMedida: r.unidade_medida || target.unidadeMedida,
    finalidade: r.finalidade || target.finalidade,
    descricao: r.descricao || target.descricao,
    detalhamentoImplementacao: r.detalhamento_implementacao || target.detalhamentoImplementacao || '',
    baseLegal: r.base_legal || target.baseLegal,
  });
  if (!existing) actions.push(target);
}
function numberOf(v: string) {
  const n = Number(String(v || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
function codeOfLabel(v: string) {
  return String(v || '').match(/^\s*([\w.]+)/)?.[1] || '';
}
function obzFromCsv(programs: Program[], actions: Action[], r: Record<string, string>): BudgetItemOBZ | null {
  const programaLabel = r.programa || '';
  const acaoLabel = r.acao || '';
  const descricao = r.descricao || r.descricao_do_item || '';
  if (!acaoLabel || !descricao) return null;
  const pCode = r.codigo_programa || codeOfLabel(programaLabel);
  let program = programs.find((p) => p.codigo === pCode);
  if (!program) {
    program = {
      id: uid('prog'), codigo: pCode, nome: programaLabel.replace(/^[\w.]+\s*-\s*/, '') || 'Programa importado',
      unidadeOrcamentaria: r.unidade_orcamentaria || '', orgao: '', problemaCentral: '', objetivo: '',
      justificativa: '', publicoAlvo: '', contexto: '', resultados: [], impactos: [], status: 'RASCUNHO',
    };
    programs.push(program);
  }
  const aCode = r.codigo_acao || codeOfLabel(acaoLabel);
  let action = actions.find((a) => a.programaId === program!.id && a.codigo === aCode);
  if (!action) {
    action = {
      id: uid('act'), codigo: aCode, nome: acaoLabel.replace(/^[\w.]+\s*-\s*/, '') || 'Ação importada',
      programaId: program.id, unidadeOrcamentaria: r.unidade_orcamentaria || '', orgao: '',
      funcao: '', subfuncao: '', tipoAcao: '', iag: '', publicoAlvo: '', produto: '',
      especificacaoProduto: '', unidadeMedida: '', finalidade: '', descricao: '', baseLegal: '', status: 'RASCUNHO',
    };
    actions.push(action);
  }
  const volume = numberOf(r.volume);
  const precoUnitario = numberOf(r.preco_unitario || r.preco);
  const frequenciaPagamento = numberOf(r.frequencia_pagamento || r.frequencia) || 1;
  const valorTotal = numberOf(r.valor_total) || volume * precoUnitario * frequenciaPagamento;
  return {
    id: uid('obz'),
    unidadeOrcamentaria: r.unidade_orcamentaria || '',
    programaId: program.id,
    actionId: action.id,
    acaoLabel,
    grupo: r.grupo || '',
    elemento: r.elemento || 'ELEMENTO',
    elementoItem: r.elemento_item || r.elementoitem || '',
    agrupamento: r.agrupamento || '',
    fonte: r.fonte || '',
    descricao,
    premissaVolume: r.premissa_volume || '',
    volume,
    premissaPreco: r.premissa_preco || '',
    precoUnitario,
    frequenciaPagamento,
    valorTotal,
    classificacaoCenario: String(r.classificacao_cenario || '').toUpperCase().includes('INCRE') ? 'INCREMENTAL' : 'LIMIAR',
    novo: /^sim$/i.test(r.novo || ''),
    descricaoCenario: r.descricao_cenario || '',
    riscoNaoFazer: r.risco_de_nao_fazer || '',
    beneficioAoFazer: r.beneficio_ao_fazer || '',
    prioridadeN3: numberOf(r.prioridade_n3),
    prioridadeN2: numberOf(r.prioridade_n2),
    prioridadeN1: numberOf(r.prioridade_n1),
    observacoes: '',
    statusValidacao: 'EM PREENCHIMENTO',
  };
}

function TablesTab({ which }: { which: 'programmatic' | 'budgetary' }) {
  const { state, update } = useApp(); const toast = useToast();
  const tables = state.support[which];
  const [openId, setOpenId] = useState(tables[0]?.id || '');
  const t = tables.find((x) => x.id === openId) || tables[0];

  const addVal = (label: string) => update((s) => { const tb = s.support[which].find((x) => x.id === t.id)!; tb.valores.push({ id: uid('v'), label, ativo: true }); tb.ultimaAlteracao = new Date().toISOString().slice(0, 10); });
  const toggle = (vid: string) => update((s) => { const tb = s.support[which].find((x) => x.id === t.id)!; const v = tb.valores.find((y) => y.id === vid)!; v.ativo = !v.ativo; });
  const del = (vid: string) => update((s) => { const tb = s.support[which].find((x) => x.id === t.id)!; tb.valores = tb.valores.filter((y) => y.id !== vid); });

  return (
    <div className="grid" style={{ gridTemplateColumns: '280px 1fr', gap: 16 }}>
      <Card title="Listas">
        {tables.map((tb) => (
          <div key={tb.id} className={'gitem' + (tb.id === t.id ? ' active' : '')} onClick={() => setOpenId(tb.id)}>
            <div className="gd">{tb.nome}</div>
            <div className="gm">{tb.valores.filter((v) => v.ativo).length} ativos · {tb.valores.length} total</div>
          </div>
        ))}
      </Card>
      <Card title={t?.nome} count={t?.valores.length}
        actions={<AddInline onAdd={(v) => { addVal(v); toast('Valor adicionado.', 'ok'); }} />}>
        <div className="table-wrap">
          <table className="dt">
            <thead><tr><th>Valor</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {t?.valores.map((v) => (
                <tr key={v.id}>
                  <td>{v.label}</td>
                  <td><span className={'badge ' + (v.ativo ? 'green' : 'gray')}>{v.ativo ? 'ativo' : 'inativo'}</span></td>
                  <td><div className="rowacts">
                    <button className="icobtn" title="Ativar/Inativar" onClick={() => toggle(v.id)}><Power size={14} /></button>
                    <button className="icobtn del" title="Excluir" onClick={() => del(v.id)}><Trash2 size={14} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
function AddInline({ onAdd }: { onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  return <div className="row"><input value={v} placeholder="Novo valor..." onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { onAdd(v.trim()); setV(''); } }} style={{ border: '1px solid #ccd6dc', borderRadius: 8, padding: '7px 10px' }} /><ActionButton color="green" icon={<Plus size={15} />} onClick={() => { if (v.trim()) { onAdd(v.trim()); setV(''); } }}>Incluir</ActionButton></div>;
}

function PerfisTab() {
  return (
    <Card title="Perfis e Permissões" lead="Matriz de permissões por perfil (padrão do protótipo). Perfis personalizados podem ser criados copiando um perfil existente.">
      <div className="table-wrap">
        <table className="dt">
          <thead><tr><th>Permissão</th>{PERFIS.map((p) => <th key={p} className="num">{p}</th>)}</tr></thead>
          <tbody>
            {PERM_LABELS.map((pl) => (
              <tr key={pl.key}><td>{pl.label}</td>{PERFIS.map((p) => <td key={p} className="num">{PERMS[p].includes(pl.key) ? <span className="badge green">✓</span> : <span className="muted">—</span>}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ImportExportTab() {
  const { state } = useApp(); const toast = useToast();
  const exportTables = () => {
    const blob = new Blob([JSON.stringify(state.support, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tabelas-apoio.json'; a.click();
  };
  return (
    <Card title="Importação e Exportação de Tabelas" lead="Importe/exporte as tabelas de apoio. O protótipo valida consistência básica antes de aplicar.">
      <div className="row">
        <ActionButton color="purple" icon={<Download size={16} />} onClick={exportTables}>Exportar tabelas (JSON)</ActionButton>
        <label className="btn purple" style={{ cursor: 'pointer' }}><Upload size={16} /> Importar tabelas
          <input type="file" accept=".json" hidden onChange={() => toast('Prévia carregada (protótipo).', 'ok')} /></label>
        <ActionButton color="ghost" icon={<History size={16} />} onClick={() => toast('Histórico de versões disponível no sistema integrado.')}>Histórico / restaurar versão</ActionButton>
      </div>
    </Card>
  );
}

function GovernancaTab() {
  const { state } = useApp();
  const all = [...state.support.programmatic, ...state.support.budgetary];
  const ativos = all.reduce((s, t) => s + t.valores.filter((v) => v.ativo).length, 0);
  const inativos = all.reduce((s, t) => s + t.valores.filter((v) => !v.ativo).length, 0);
  return (
    <>
      <div className="grid g4">
        <div className="stat"><div className="k">LISTAS</div><div className="v">{all.length}</div></div>
        <div className="stat"><div className="k">REGISTROS ATIVOS</div><div className="v green">{ativos}</div></div>
        <div className="stat"><div className="k">REGISTROS INATIVOS</div><div className="v">{inativos}</div></div>
        <div className="stat"><div className="k">ÚLTIMA ALTERAÇÃO</div><div className="v" style={{ fontSize: 15 }}>2026-02-27</div></div>
      </div>
      <Card title="Governança das Configurações" lead="Toda alteração em tabelas de apoio reflete automaticamente nos seletores da Formulação Programática, Mapa, OBZ, Coerência e Espelhos.">
        <DataList lists={all as SupportList[]} />
      </Card>
    </>
  );
}
function DataList({ lists }: { lists: SupportList[] }) {
  return (
    <div className="table-wrap">
      <table className="dt">
        <thead><tr><th>Lista</th><th className="num">Ativos</th><th className="num">Inativos</th><th>Responsável</th><th>Última alteração</th></tr></thead>
        <tbody>
          {lists.map((t) => (
            <tr key={t.id}><td>{t.nome}</td><td className="num">{t.valores.filter((v) => v.ativo).length}</td><td className="num">{t.valores.filter((v) => !v.ativo).length}</td><td>{t.responsavel}</td><td>{t.ultimaAlteracao}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
