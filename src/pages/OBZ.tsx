import { useState, useMemo, type CSSProperties } from 'react';
import { useApp } from '../store/AppStore';
import { Card, Tabs, FormField, SelectField, ActionButton, StatusBadge, Modal, Stat, useToast, brl, uid } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { ImportWizard } from '../components/ImportWizard';
import { ValidationPanel, type Issue } from '../components/ValidationPanel';
import type { BudgetItemOBZ, Cenario, SelectionLists } from '../types';
import { Plus, Copy, Trash2, Pencil, Save, Upload, Download, Send, CheckCircle2, RotateCcw } from 'lucide-react';

const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const blank = (pid: string, uo: string): BudgetItemOBZ => ({
  id: uid('obz'), unidadeOrcamentaria: uo, programaId: pid, actionId: '', acaoLabel: '', grupo: '3 — Outras Despesas de Custeio',
  elemento: 'ELEMENTO', elementoItem: '', agrupamento: '', fonte: '10', descricao: '', premissaVolume: '', volume: 0, premissaPreco: '',
  precoUnitario: 0, frequenciaPagamento: 1, valorTotal: 0, classificacaoCenario: 'LIMIAR', novo: false, descricaoCenario: '',
  riscoNaoFazer: '', beneficioAoFazer: '', prioridadeN3: 0, prioridadeN2: 0, prioridadeN1: 0, observacoes: '', statusValidacao: 'EM PREENCHIMENTO',
});

export function ObzPage({ initialTab }: { initialTab?: string }) {
  const { state, update, can } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState(initialTab || 'elaboracao');
  const pid = state.currentProgramId;
  const items = state.budgetItems.filter((b) => b.programaId === pid);
  const editable = can('editObz');
  const [edit, setEdit] = useState<BudgetItemOBZ | null>(null);

  const tabs = [
    { id: 'elaboracao', label: 'Elaboração OBZ' },
    { id: 'importacao', label: 'Importação da Planilha' },
    { id: 'cenarios', label: 'Cenários e Priorização' },
    { id: 'validacao', label: 'Validação OBZ' },
  ];

  const saveItem = (it: BudgetItemOBZ) => {
    it.valorTotal = num(it.volume) * num(it.precoUnitario) * num(it.frequenciaPagamento);
    if (it.classificacaoCenario === 'LIMIAR') { it.prioridadeN3 = it.prioridadeN2 = it.prioridadeN1 = 0; }
    if (!it.descricao.trim()) { toast('Informe a descrição do item.', 'err'); return; }
    if (!it.acaoLabel) { toast('Selecione a ação.', 'err'); return; }
    if (!it.beneficioAoFazer.trim()) { toast('Benefício ao fazer é obrigatório.', 'err'); return; }
    if (it.classificacaoCenario === 'LIMIAR' && !it.riscoNaoFazer.trim()) { toast('Risco de não fazer é obrigatório para Limiar.', 'err'); return; }
    if (it.classificacaoCenario === 'INCREMENTAL') {
      const sameAcao = items.filter((x) => x.id !== it.id && x.acaoLabel === it.acaoLabel && x.classificacaoCenario === 'INCREMENTAL');
      for (const [lab, val, key] of [['N3', it.prioridadeN3, 'prioridadeN3'], ['N2', it.prioridadeN2, 'prioridadeN2'], ['N1', it.prioridadeN1, 'prioridadeN1']] as const) {
        if (val && (val < 1 || val > 10)) { toast(`Prioridade ${lab} deve ser de 1 a 10.`, 'err'); return; }
        if (val && sameAcao.some((x) => (x as any)[key] === val)) { toast(`Prioridade ${lab}=${val} já usada nesta ação.`, 'err'); return; }
      }
    }
    update((s) => { const i = s.budgetItems.findIndex((x) => x.id === it.id); if (i >= 0) s.budgetItems[i] = it; else s.budgetItems.push(it); });
    setEdit(null); toast('Item OBZ salvo.', 'ok');
  };

  return (
    <>
      <PageHeader crumb="Formulação do Orçamento › OBZ" title="Orçamento Base Zero"
        sub="Itens de custo por ação, em cenários Limiar e Incremental, com priorização N3 · N2 · N1." />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'elaboracao' && (
        <Card title="Itens orçamentários" count={items.length}
          actions={<>
            <ActionButton color="green" icon={<Plus size={16} />} disabled={!editable} onClick={() => setEdit(blank(pid, state.unidade))}>Criar item</ActionButton>
          </>}>
          <div className="grid g4" style={{ marginBottom: 14 }}>
            <Stat k="ITENS" v={items.length} color="blue" />
            <Stat k="TOTAL" v={brl(items.reduce((s, b) => s + b.valorTotal, 0))} />
            <Stat k="LIMIAR" v={brl(items.filter((b) => b.classificacaoCenario === 'LIMIAR').reduce((s, b) => s + b.valorTotal, 0))} />
            <Stat k="INCREMENTAL" v={brl(items.filter((b) => b.classificacaoCenario === 'INCREMENTAL').reduce((s, b) => s + b.valorTotal, 0))} color="orange" />
          </div>
          <DataTable<BudgetItemOBZ> empty="Nenhum item OBZ. Crie um item ou importe a planilha." rows={items} columns={[
            { key: 'descricao', header: 'Descrição', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.descricao}</div><div className="small muted">{r.elementoItem} · {r.agrupamento} · fonte {r.fonte}</div></div> },
            { key: 'acaoLabel', header: 'Ação', render: (r) => r.acaoLabel.slice(0, 30) },
            { key: 'classificacaoCenario', header: 'Cenário', render: (r) => <span className={'badge ' + (r.classificacaoCenario === 'LIMIAR' ? 'limiar' : 'incr')}>{r.classificacaoCenario === 'LIMIAR' ? 'Limiar' : 'Incremental'}</span> },
            { key: 'prio', header: 'Prio (N3/N2/N1)', render: (r) => `${r.prioridadeN3}/${r.prioridadeN2}/${r.prioridadeN1}` },
            { key: 'valorTotal', header: 'Valor', num: true, render: (r) => brl(r.valorTotal) },
            { key: 'acts', header: '', render: (r) => <div className="rowacts">
              <button className="icobtn" disabled={!editable} title="Editar" onClick={() => setEdit({ ...r })}><Pencil size={14} /></button>
              <button className="icobtn" disabled={!editable} title="Duplicar" onClick={() => update((s) => s.budgetItems.push({ ...r, id: uid('obz') }))}><Copy size={14} /></button>
              <button className="icobtn del" disabled={!editable} title="Excluir" onClick={() => update((s) => { s.budgetItems = s.budgetItems.filter((x) => x.id !== r.id); })}><Trash2 size={14} /></button>
            </div> },
          ]} />
        </Card>
      )}

      {tab === 'importacao' && (
        <Card title="Importação da Planilha OBZ" lead="Importe a planilha .xlsx (aba BASE OBZ). Os itens e as listas de seleção são populados automaticamente.">
          <ImportWizard onImport={(newItems, lists) => {
            update((s) => {
              for (const it of newItems) { it.programaId = pid; s.budgetItems.push(it); }
              mergeLists(s.lists, lists);
            });
          }} />
        </Card>
      )}

      {tab === 'cenarios' && <CenariosTab items={items} />}
      {tab === 'validacao' && <ValidacaoObzTab items={items} />}

      {edit && <ItemModal it={edit} setIt={setEdit} onSave={saveItem} lists={state.lists} actions={state.actions.filter((a) => a.programaId === pid)} editable={editable} />}
    </>
  );
}

function mergeLists(target: SelectionLists, src: Partial<SelectionLists>) {
  for (const k of Object.keys(src) as (keyof SelectionLists)[]) {
    const arr = src[k] as string[]; if (!arr) continue;
    for (const v of arr) if (v && !(target[k] as string[]).includes(v)) (target[k] as string[]).push(v);
  }
}

function ItemModal({ it, setIt, onSave, lists, actions, editable }: { it: BudgetItemOBZ; setIt: (i: BudgetItemOBZ) => void; onSave: (i: BudgetItemOBZ) => void; lists: SelectionLists; actions: any[]; editable: boolean }) {
  const set = (k: keyof BudgetItemOBZ, v: any) => setIt({ ...it, [k]: v });
  const total = num(it.volume) * num(it.precoUnitario) * num(it.frequenciaPagamento);
  const limiar = it.classificacaoCenario === 'LIMIAR';
  const acaoCodigo = String(it.acaoLabel || '').match(/^\s*([\w.]+)/)?.[1] || '';
  const selectedAction = actions.find((a) => a.codigo === acaoCodigo || a.id === it.actionId);
  const detail = (k: string, v: any) => <div className="class-detail-item"><span>{k}</span><b>{v || '—'}</b></div>;
  return (
    <Modal wide title={(it.descricao ? 'Editar' : 'Novo') + ' item orçamentário'} sub={it.acaoLabel} onClose={() => setIt(null as any)}
      foot={<><ActionButton color="ghost" onClick={() => setIt(null as any)}>Cancelar</ActionButton><ActionButton color="green" icon={<Save size={16} />} disabled={!editable} onClick={() => onSave({ ...it, valorTotal: total })}>Salvar item</ActionButton></>}>
      <div className="grid g3">
        <SelectField label="Unidade Orçamentária" required value={it.unidadeOrcamentaria} options={lists.unidades} onChange={(v) => set('unidadeOrcamentaria', v)} />
        <SelectField label="Ação" required value={it.acaoLabel} options={lists.acoes} onChange={(v) => set('acaoLabel', v)} />
        <SelectField label="Grupo" required value={it.grupo} options={lists.grupos} onChange={(v) => set('grupo', v)} />
        <SelectField label="Elemento-item" required value={it.elementoItem} options={lists.elementosItens} onChange={(v) => set('elementoItem', v)} />
        <SelectField label="Agrupamento" value={it.agrupamento} options={lists.agrupamentos} onChange={(v) => set('agrupamento', v)} />
        <SelectField label="Fonte" required value={it.fonte} options={lists.fontes} onChange={(v) => set('fonte', v)} />
      </div>
      <div className="class-detail">
        <div className="class-detail-head">
          <h3>Detalhamento da classificação orçamentária</h3>
          <span className="badge blue">estrutura da despesa</span>
        </div>
        <div className="class-detail-grid">
          {detail('Unidade Orçamentária', it.unidadeOrcamentaria)}
          {detail('Ação', it.acaoLabel)}
          {detail('Função', selectedAction?.funcao)}
          {detail('Subfunção', selectedAction?.subfuncao)}
          {detail('Tipo de ação', selectedAction?.tipoAcao)}
          {detail('IAG', selectedAction?.iag)}
          {detail('Grupo de despesa', it.grupo)}
          {detail('Elemento', it.elemento)}
          {detail('Elemento-item', it.elementoItem)}
          {detail('Agrupamento', it.agrupamento)}
          {detail('Fonte', it.fonte)}
          {detail('Cenário OBZ', it.classificacaoCenario)}
        </div>
      </div>
      <FormField label="Descrição do item" required textarea value={it.descricao} onChange={(v) => set('descricao', v)} />
      <div className="grid g2">
        <FormField label="Premissa de volume" value={it.premissaVolume} onChange={(v) => set('premissaVolume', v)} />
        <FormField label="Volume" type="number" value={it.volume} onChange={(v) => set('volume', num(v))} />
        <FormField label="Premissa de preço" value={it.premissaPreco} onChange={(v) => set('premissaPreco', v)} />
        <FormField label="Preço unitário (R$)" type="number" value={it.precoUnitario} onChange={(v) => set('precoUnitario', num(v))} />
        <FormField label="Frequência de pagamento" type="number" value={it.frequenciaPagamento} onChange={(v) => set('frequenciaPagamento', num(v))} />
      </div>
      <div className="calc"><span>VALOR TOTAL (volume × preço × frequência)</span><span className="v">{brl(total)}</span></div>
      <div className="grid g2">
        <div className="field"><label>Classificação do cenário <span className="req">*</span></label>
          <select value={it.classificacaoCenario} onChange={(e) => set('classificacaoCenario', e.target.value as Cenario)}><option value="LIMIAR">Limiar — mínimo de sobrevivência</option><option value="INCREMENTAL">Incremental — valor agregado</option></select></div>
        <div className="field"><label>Novo?</label><select value={it.novo ? 'sim' : 'nao'} onChange={(e) => set('novo', e.target.value === 'sim')}><option value="nao">Não</option><option value="sim">Sim</option></select></div>
      </div>
      <FormField label="Descrição do cenário" textarea value={it.descricaoCenario} onChange={(v) => set('descricaoCenario', v)} />
      <div className="grid g2">
        <FormField label="Benefício ao fazer" required textarea value={it.beneficioAoFazer} onChange={(v) => set('beneficioAoFazer', v)} />
        <FormField label={'Risco de não fazer' + (limiar ? ' (obrigatório p/ Limiar)' : '')} required={limiar} textarea value={it.riscoNaoFazer} onChange={(v) => set('riscoNaoFazer', v)} />
      </div>
      <div className="grid g3">
        <FormField label="Prioridade N3" type="number" disabled={limiar} value={limiar ? 0 : it.prioridadeN3} onChange={(v) => set('prioridadeN3', num(v))} hint={limiar ? '0 automático (Limiar)' : '1 a 10, único na ação'} />
        <FormField label="Prioridade N2" type="number" disabled={limiar} value={limiar ? 0 : it.prioridadeN2} onChange={(v) => set('prioridadeN2', num(v))} />
        <FormField label="Prioridade N1" type="number" disabled={limiar} value={limiar ? 0 : it.prioridadeN1} onChange={(v) => set('prioridadeN1', num(v))} />
      </div>
      <FormField label="Observações" textarea value={it.observacoes} onChange={(v) => set('observacoes', v)} />
    </Modal>
  );
}

function CenariosTab({ items }: { items: BudgetItemOBZ[] }) {
  const [fCen, setFCen] = useState(''); const [fGrupo, setFGrupo] = useState('');
  const filtered = items.filter((b) => (!fCen || b.classificacaoCenario === fCen) && (!fGrupo || b.grupo === fGrupo));
  const grupos = Array.from(new Set(items.map((b) => b.grupo)));
  const groupBy = (key: (b: BudgetItemOBZ) => string) => {
    const m: Record<string, number> = {}; for (const b of filtered) m[key(b)] = (m[key(b)] || 0) + b.valorTotal; return m;
  };
  const totalAll = filtered.reduce((s, b) => s + b.valorTotal, 0) || 1;
  const Bars = ({ title, data }: { title: string; data: Record<string, number> }) => (
    <Card title={title}>
      {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
        <div key={k} style={{ marginBottom: 9 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{k || '—'}</span><span className="small" style={{ fontWeight: 700 }}>{brl(v)}</span></div>
          <div className="bar"><i style={{ width: (v / totalAll * 100) + '%', background: '#0a6cb0' }} /></div>
        </div>
      ))}
      {Object.keys(data).length === 0 && <div className="empty">Sem dados.</div>}
    </Card>
  );
  return (
    <>
      <Card title="Filtros">
        <div className="grid g3">
          <SelectField label="Cenário" value={fCen} options={['LIMIAR', 'INCREMENTAL']} onChange={setFCen} />
          <SelectField label="Grupo" value={fGrupo} options={grupos} onChange={setFGrupo} />
          <Stat k="TOTAL FILTRADO" v={brl(filtered.reduce((s, b) => s + b.valorTotal, 0))} />
        </div>
      </Card>
      <div className="grid g2">
        <Bars title="Total por ação" data={groupBy((b) => b.acaoLabel.slice(0, 28))} />
        <Bars title="Total por agrupamento" data={groupBy((b) => b.agrupamento)} />
        <Bars title="Total por elemento-item" data={groupBy((b) => b.elementoItem)} />
        <Bars title="Total por fonte" data={groupBy((b) => 'Fonte ' + b.fonte)} />
      </div>
    </>
  );
}

function ValidacaoObzTab({ items }: { items: BudgetItemOBZ[] }) {
  const { update, can, state } = useApp();
  const toast = useToast();
  const motivos = ['Item mal justificado', 'Ultrapassou limite da LRF', 'COFIN não aprovou', 'Classificação inconsistente', 'Sem vínculo programático', 'Outro'];
  const itemIssues = (b: BudgetItemOBZ): string[] => {
    const w: string[] = [];
    if (!b.acaoLabel) w.push('sem ação'); if (!b.grupo) w.push('sem grupo'); if (!b.elementoItem) w.push('sem elemento-item');
    if (!b.agrupamento) w.push('sem agrupamento'); if (!b.fonte) w.push('sem fonte'); if (!b.descricao) w.push('sem descrição');
    if (b.volume <= 0 || b.precoUnitario <= 0 || b.frequenciaPagamento <= 0) w.push('volume/preço/frequência inválidos');
    if (b.classificacaoCenario === 'LIMIAR' && !b.riscoNaoFazer) w.push('limiar sem risco de não fazer');
    if (b.classificacaoCenario === 'INCREMENTAL' && !b.beneficioAoFazer) w.push('incremental sem benefício');
    if (b.novo && !b.descricaoCenario) w.push('novo sem descrição do cenário');
    return w;
  };
  const allIssues: Issue[] = [];
  for (const b of items) { const w = itemIssues(b); if (w.length) allIssues.push({ level: 'err', text: `${b.descricao.slice(0, 40)}: ${w.join(', ')}.` }); }

  const setStatusAll = (st: BudgetItemOBZ['statusValidacao'], aviso: string) => {
    update((s) => { for (const b of s.budgetItems) if (b.programaId === state.currentProgramId) b.statusValidacao = st; });
    alert(aviso);
  };
  const setItemValidation = (id: string, k: keyof BudgetItemOBZ, v: any) => update((s) => {
    const b = s.budgetItems.find((x) => x.id === id);
    if (b) (b as any)[k] = v;
  });
  const dcmefoCanEdit = can('validarDcmefo') || state.perfil === 'Administrador';

  return (
    <>
      <Card title="Pendências por item"><ValidationPanel issues={allIssues.length ? allIssues : [{ level: 'ok', text: 'Nenhuma pendência encontrada nos itens.' }]} /></Card>
      <Card title="Fluxo de validação (N3 · N2 · N1 · DCMEFO)"
        actions={items[0] ? <StatusBadge status={items[0].statusValidacao} /> : undefined}
        lead="N2 pode retornar ao N3; N1 pode retornar ao N2. Depois da aprovação N1, apenas DCMEFO/SEPLAG ou Administrador devolve ao órgão.">
        <div className="row">
          <ActionButton color="blue" icon={<Send size={16} />} disabled={!can('enviarValidacao') || allIssues.length > 0} onClick={() => { setStatusAll('ENVIADO PARA VALIDAÇÃO', 'OBZ enviada pelo N3 para validação.'); toast('Enviado para validação.', 'ok'); }}>N3 enviar</ActionButton>
          <ActionButton color="green" icon={<CheckCircle2 size={16} />} disabled={!can('validarOrgao')} onClick={() => { setStatusAll('VALIDADO PELO ÓRGÃO', 'Aprovação N2 registrada. O item segue para análise N1.'); toast('Aprovação N2 registrada.', 'ok'); }}>N2 aprovar</ActionButton>
          <ActionButton color="green" icon={<CheckCircle2 size={16} />} disabled={!can('validarOrgao')} onClick={() => { setStatusAll('VALIDADO PELO ÓRGÃO', 'Aprovação N1 registrada. A partir deste ponto, retorno ao órgão apenas por DCMEFO/SEPLAG ou Administrador.'); toast('Aprovação N1 registrada.', 'ok'); }}>N1 aprovar e fechar órgão</ActionButton>
          <ActionButton color="green" icon={<CheckCircle2 size={16} />} disabled={!can('validarDcmefo')} onClick={() => { setStatusAll('VALIDADO DCMEFO/SEPLAG', 'DCMEFO/SEPLAG aprovou a OBZ. Cotas aprovadas podem ser consolidadas.'); toast('Validado pela DCMEFO/SEPLAG.', 'ok'); }}>DCMEFO aprovar</ActionButton>
          <ActionButton color="red" icon={<RotateCcw size={16} />} disabled={!can('devolver')} onClick={() => { setStatusAll('DEVOLVIDO PARA AJUSTES', can('validarDcmefo') ? 'DCMEFO/SEPLAG devolveu ao órgão para ajuste.' : 'Devolução registrada para o nível anterior.'); toast('Devolvido para ajustes.', 'ok'); }}>Devolver</ActionButton>
        </div>
        {allIssues.length > 0 && <div className="alert warn" style={{ marginTop: 12 }}>Resolva as pendências dos itens antes de enviar para validação.</div>}
      </Card>
      <Card title="Validação de cota pela DCMEFO" lead="Apenas DCMEFO/SEPLAG e Administrador deveriam interagir aqui. Quando a cota não for aprovada, registre motivo e comentário específico por item OBZ.">
        <div className="table-wrap">
          <table className="dt">
            <thead><tr><th>Item OBZ</th><th className="num">Valor</th><th>Cota</th><th>Motivo</th><th>Comentário específico</th></tr></thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.descricao.slice(0, 54) || 'Item sem descrição'}</b><div className="small muted">{b.elementoItem} · {b.agrupamento} · fonte {b.fonte}</div></td>
                  <td className="num">{brl(b.valorTotal)}</td>
                  <td>
                    <select value={b.cotaAprovada == null ? '' : b.cotaAprovada ? 'sim' : 'nao'} disabled={!dcmefoCanEdit} onChange={(e) => setItemValidation(b.id, 'cotaAprovada', e.target.value === '' ? undefined : e.target.value === 'sim')} style={cellInput}>
                      <option value="">Em análise</option><option value="sim">Aprovada</option><option value="nao">Não aprovada</option>
                    </select>
                  </td>
                  <td>
                    <select value={b.motivoValidacao || ''} disabled={!dcmefoCanEdit} onChange={(e) => setItemValidation(b.id, 'motivoValidacao', e.target.value)} style={cellInput}>
                      <option value="">Selecionar motivo</option>{motivos.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </td>
                  <td><input value={b.observacoes || ''} disabled={!dcmefoCanEdit} onChange={(e) => setItemValidation(b.id, 'observacoes', e.target.value)} placeholder="Comentário específico da análise..." style={cellInput} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

const cellInput: CSSProperties = { border: '1px solid #d4dde3', borderRadius: 7, padding: '5px 7px', fontSize: 12, width: '100%', minWidth: 120 };
