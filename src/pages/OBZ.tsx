import { budgetUnitOptions, formatUnitCode, formatUnitLabel } from '../services/budgetUnits';
import { useState, type CSSProperties } from 'react';
import { useApp } from '../store/AppStore';
import { Card, Tabs, FormField, SelectField, ActionButton, StatusBadge, Modal, Stat, useToast, brl, uid } from '../components/ui';
import { CompactHelpContext } from '../components/HelpTip';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { ImportWizard } from '../components/ImportWizard';
import { ValidationPanel, type Issue } from '../components/ValidationPanel';
import { SearchableSelect } from '../components/SearchableSelect';
import { applyBudgetImport, budgetItemIssues, budgetPriorityIssues, calculateBudgetTotal, codeOf, effectiveBudgetTotal, parseBudgetNumber, reconcileBudgetItem, unitCode } from '../services/obzData';
import type { AppState, BudgetItemOBZ, Cenario, Program, Action } from '../types';
import { Plus, Copy, Trash2, Pencil, Save, Send, CheckCircle2, RotateCcw } from 'lucide-react';

const num = (value: unknown) => parseBudgetNumber(value) ?? 0;
const inputNumber = (value: string): number | null => value.trim() === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const money = (item: BudgetItemOBZ) => effectiveBudgetTotal(item) == null ? 'Não informado' : brl(item.valorTotal);
const blank = (state: AppState): BudgetItemOBZ => {
  const program = state.programs.find((record) => record.id === state.currentProgramId);
  return {
    id: 'obz-local-' + crypto.randomUUID(), unidadeOrcamentaria: state.unidade, codigoUnidadeOrcamentaria: unitCode(state.unidade),
    programaCodigo: codeOf(program?.codigo), programaId: '', actionId: '', exercise: state.planning?.exercise || null,
    acaoLabel: '', grupo: '', elemento: 'ELEMENTO', elementoItem: '', agrupamento: '', fonte: '', descricao: '',
    premissaVolume: '', volume: 0, premissaPreco: '', precoUnitario: 0, frequenciaPagamento: 1, valorTotal: 0,
    quantities: { volume: null, precoUnitario: null, frequenciaPagamento: 1 }, totalMode: 'ausente',
    classificacaoCenario: 'NÃO INFORMADO', novo: false, descricaoCenario: '', riscoNaoFazer: '', beneficioAoFazer: '',
    prioridadeN3: 0, prioridadeN2: 0, prioridadeN1: 0, observacoes: '', statusValidacao: 'EM PREENCHIMENTO',
  };
};
export function ObzPage({ initialTab }: { initialTab?: string }) {
  const { state, update, can } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState(initialTab || 'elaboracao');
  const pid = state.currentProgramId;
  const pendingCount = state.budgetItems.filter((item) => item.linkage?.status !== 'vinculado').length;
  const [scope, setScope] = useState(state.budgetItems.some((item) => item.programaId === pid) ? 'programa' : 'pendentes');
  const items = state.budgetItems.filter((item) => scope === 'todos' || (scope === 'pendentes' ? item.linkage?.status !== 'vinculado' : item.programaId === pid));
  const editable = can('editObz');
  const allowed = (item: BudgetItemOBZ) => editable && (state.perfil !== 'Gestor UA' || unitCode(state.unidade) === unitCode(item.codigoUnidadeOrcamentaria || item.unidadeOrcamentaria));
  const [edit, setEdit] = useState<BudgetItemOBZ | null>(null);
  const [remove, setRemove] = useState<BudgetItemOBZ | null>(null);
  const saveItem = (record: BudgetItemOBZ) => {
    if (!allowed(record)) return;
    if (record.exercise && !/^\d{4}$/.test(record.exercise)) { toast('Informe o exercício com quatro dígitos ou deixe em branco.', 'err'); return; }
    if (record.classificacaoCenario === 'LIMIAR') record = { ...record, prioridadeN3: 0, prioridadeN2: 0, prioridadeN1: 0 };
    const next = reconcileBudgetItem(record, { programs: state.programs, actions: state.actions, exercise: state.planning?.exercise });
    update((draft) => { const index = draft.budgetItems.findIndex((item) => item.id === next.id); if (index >= 0) draft.budgetItems[index] = next; else draft.budgetItems.push(next); });
    setEdit(null); toast('Rascunho OBZ salvo. Pendências continuam identificadas.', 'ok');
  };
  return <CompactHelpContext.Provider value><div className="compact-workspace obz-workspace">
    <PageHeader crumb="Formulação programática-orçamentária" title="Orçamento Base Zero" sub="Base OBZ independente, com origem preservada e vínculos explícitos com o planejamento." />
    <Tabs tabs={[{ id: 'elaboracao', label: 'Itens OBZ' }, { id: 'importacao', label: 'Importar planilha' }, { id: 'cenarios', label: 'Cenários e prioridades' }, { id: 'validacao', label: 'Conferência e validação' }]} active={tab} onChange={setTab} />
    <Card><div className="obz-scope"><label className="field">Exibir itens<select aria-label="Escopo da base OBZ" value={scope} onChange={(event) => setScope(event.target.value)}><option value="programa">Vinculados ao programa selecionado</option><option value="pendentes">Sem vínculo confirmado ({pendingCount})</option><option value="todos">Toda a base OBZ ({state.budgetItems.length})</option></select></label><p className="small muted">Exercício, programa, UO e ação precisam corresponder para confirmar um vínculo. Registros de outra origem continuam disponíveis nesta base.</p></div></Card>
    {tab === 'elaboracao' && <Card title="Itens orçamentários" count={items.length} actions={<ActionButton icon={<Plus size={15} />} disabled={!editable} onClick={() => setEdit(blank(state))}>Rascunhar item</ActionButton>}>
      <div className="grid g4"><Stat k="Itens nesta seleção" v={items.length} /><Stat k="Total informado" v={brl(items.reduce((sum, item) => sum + (effectiveBudgetTotal(item) ?? 0), 0))} /><Stat k="Vínculos pendentes" v={items.filter((item) => item.linkage?.status !== 'vinculado').length} color="orange" /><Stat k="Valor não informado" v={items.filter((item) => effectiveBudgetTotal(item) == null).length} /></div>
      <DataTable<BudgetItemOBZ> pageSize={25} searchLabel="Pesquisar itens OBZ" searchText={(item) => [item.descricao,item.unidadeOrcamentaria,item.acaoLabel,item.programaCodigo,item.elementoItem,item.fonte].join(' ')} empty="Nenhum item nesta seleção. Consulte toda a base ou importe uma planilha." rows={items} columns={[
        { key: 'descricao', header: 'Descrição', render: (item) => <div><strong>{item.descricao || 'Item em rascunho'}</strong><div className="small muted">{item.elementoItem} · fonte {item.fonte || 'não informada'}</div></div> },
        { key: 'unidadeOrcamentaria', header: 'UO / exercício', render: (item) => <div>{formatUnitLabel(item.unidadeOrcamentaria) || 'UO não informada'}<div className="small muted">{item.exercise || 'Exercício não informado'}</div></div> },
        { key: 'acaoLabel', header: 'Programa / ação', render: (item) => <div>Programa {item.programaCodigo || codeOf(item.source?.programLabel) || 'não identificado'}<div className="small muted">{item.acaoLabel || 'Ação não informada'}</div></div> },
        { key: 'linkage', header: 'Vínculo', render: (item) => <span className={'badge ' + (item.linkage?.status === 'vinculado' ? 'green' : 'orange')}>{item.linkage?.status === 'vinculado' ? 'Confirmado' : 'Pendente'}</span> },
        { key: 'classificacaoCenario', header: 'Cenário', render: (item) => item.classificacaoCenario },
        { key: 'valorTotal', header: 'Valor', num: true, render: money },
        { key: 'acts', header: 'Ficha', render: (item) => <div className="rowacts"><button className="icobtn" title={allowed(item) ? 'Editar item' : 'Consultar item'} aria-label={'Abrir item ' + item.descricao} onClick={() => setEdit(structuredClone(item))}><Pencil size={14} /></button><button className="icobtn" disabled={!allowed(item)} title="Duplicar como rascunho" onClick={() => { setEdit({ ...structuredClone(item), id: 'obz-local-' + crypto.randomUUID(), statusValidacao: 'EM PREENCHIMENTO' }); }}><Copy size={14} /></button><button className="icobtn del" disabled={!allowed(item)} title="Descartar item" onClick={() => setRemove(item)}><Trash2 size={14} /></button></div> },
      ]} />
    </Card>}
    {tab === 'importacao' && <Card title="Importar planilha OBZ"><ImportWizard editable={editable} onImport={(newItems, lists) => update((draft) => {
      applyBudgetImport(draft, newItems);
      for (const key of Object.keys(lists) as (keyof AppState['lists'])[]) draft.lists[key] = [...new Set([...draft.lists[key], ...(lists[key] || [])])];
    })} /></Card>}
    {tab === 'cenarios' && <CenariosTab items={items} />}
    {tab === 'validacao' && <ValidacaoObzTab items={items} />}
    {edit && <ItemModal it={edit} setIt={setEdit} onSave={saveItem} state={state} editable={allowed(edit)} />}
    {remove && <Modal title="Descartar item OBZ?" onClose={() => setRemove(null)} foot={<><ActionButton color="ghost" onClick={() => setRemove(null)}>Cancelar</ActionButton><ActionButton color="red" disabled={!allowed(remove) || state.links.some((link) => link.budgetItemId === remove.id)} onClick={() => { update((draft) => { draft.planning?.history?.push({ id: 'operacao-' + crypto.randomUUID(), kind: 'budgetItem', entityId: remove.id, operation: 'descarte', at: new Date().toISOString(), reason: 'Descarte explícito de item OBZ', before: structuredClone(remove), after: null }); draft.budgetItems = draft.budgetItems.filter((item) => item.id !== remove.id); }); setRemove(null); }}>Confirmar descarte</ActionButton></>}><p>{remove.descricao}</p>{state.links.some((link) => link.budgetItemId === remove.id) ? <p className="alert warn">Este item tem vínculos na matriz de coerência. Resolva esses vínculos antes do descarte.</p> : <p>O conteúdo será preservado no histórico da proposta.</p>}</Modal>}
  </div></CompactHelpContext.Provider>;
}

function ItemModal({ it, setIt, onSave, state, editable }: { it: BudgetItemOBZ; setIt: (item: BudgetItemOBZ | null) => void; onSave: (item: BudgetItemOBZ) => void; state: AppState; editable: boolean }) {
  const { reference } = useApp();
  const set = (key: keyof BudgetItemOBZ, value: any) => setIt({ ...it, [key]: value });
  const quantities = it.quantities || { volume: it.volume, precoUnitario: it.precoUnitario, frequenciaPagamento: it.frequenciaPagamento };
  const calculated = calculateBudgetTotal(quantities.volume, quantities.precoUnitario, quantities.frequenciaPagamento);
  const total = it.totalMode === 'calculado' ? calculated : effectiveBudgetTotal(it);
  const limiar = it.classificacaoCenario === 'LIMIAR';
  const programCode = it.programaCodigo || codeOf(it.source?.programLabel);
  const program = state.programs.find((record) => codeOf(record.codigo) === programCode);
  const candidates = state.actions.filter((record) => record.programaId === program?.id && unitCode(record.codigoUnidadeOrcamentaria || record.unidadeOrcamentaria) === unitCode(it.codigoUnidadeOrcamentaria || it.unidadeOrcamentaria));
  const selectedAction = candidates.find((record) => record.id === it.actionId) || candidates.find((record) => codeOf(record.codigo) === codeOf(it.acaoLabel));
  const projection = reconcileBudgetItem(it, { programs: state.programs, actions: state.actions, exercise: state.planning?.exercise });
  return <Modal wide title={editable ? 'Ficha do item OBZ' : 'Consulta do item OBZ'} sub="Origem preservada · alterações na proposta local" onClose={() => setIt(null)} foot={<><ActionButton color="ghost" onClick={() => setIt(null)}>Fechar</ActionButton><ActionButton icon={<Save size={15} />} disabled={!editable} onClick={() => onSave({ ...it, valorTotal: total ?? 0, totalMode: total == null ? 'ausente' : it.totalMode || 'declarado' })}>Salvar rascunho</ActionButton></>}>
    <fieldset className="obz-item-fields" disabled={!editable}>
      <section className="sheet-section"><h2>Identificação e vínculo com o planejamento</h2>
        <FormField label="Exercício do item OBZ" value={it.exercise || ''} placeholder="Não informado" onChange={(value) => set('exercise', value || null)} />
        <SearchableSelect disabled={!editable} label="Programa do item OBZ" value={programCode} options={state.programs.map((record) => ({ value: codeOf(record.codigo), label: record.codigo + ' — ' + record.nome }))} onChange={(value) => setIt({ ...it, programaCodigo: value, programaId: '', actionId: '' })} />
        <SelectField label="Unidade orçamentária do item" value={formatUnitLabel(it.unidadeOrcamentaria)} options={[...new Set([formatUnitLabel(it.unidadeOrcamentaria), ...budgetUnitOptions(reference)].filter(Boolean))]} onChange={(value) => setIt({ ...it, unidadeOrcamentaria: value, codigoUnidadeOrcamentaria: unitCode(value), actionId: '' })} />
        <SearchableSelect disabled={!editable} label="Ação do item OBZ" value={selectedAction?.id || ''} options={candidates.map((action) => ({ value: action.id, label: action.codigo + ' · UO ' + formatUnitCode(action.codigoUnidadeOrcamentaria) + ' · ' + action.nome }))} onChange={(value) => { const action = candidates.find((record) => record.id === value); setIt({ ...it, actionId: value, acaoLabel: action ? action.codigo + ' - ' + action.nome : '' }); }} />
        <p className="small muted">Ação declarada na proposta: {it.acaoLabel || 'Não informada'}</p>
        <div className={'alert ' + (projection.linkage?.status === 'vinculado' ? 'info' : 'warn')} role="status">{projection.linkage?.status === 'vinculado' ? 'Correspondência exata: o vínculo será confirmado ao salvar.' : projection.linkage?.issues.join(' ')}</div>
      </section>
      <section className="sheet-section"><h2>Descrição e classificação</h2><FormField label="Descrição do item" textarea value={it.descricao} onChange={(value) => set('descricao', value)} /><div className="grid g2">{([['grupo','Grupo','grupos'], ['elementoItem','Elemento-item','elementosItens'], ['agrupamento','Agrupamento','agrupamentos'], ['fonte','Fonte','fontes']] as const).map(([key,label,list]) => <SelectField key={key} label={label} value={it[key]} options={[...new Set([it[key], ...state.lists[list]].filter(Boolean))]} onChange={(value) => set(key, value)} />)}</div></section>
      <section className="sheet-section"><h2>Memória de cálculo e valor</h2><div className="grid g2"><FormField label="Premissa de volume" value={it.premissaVolume} onChange={(value) => set('premissaVolume', value)} /><FormField label="Premissa de preço" value={it.premissaPreco} onChange={(value) => set('premissaPreco', value)} />{([['volume','Volume'], ['precoUnitario','Preço unitário'], ['frequenciaPagamento','Frequência de pagamento']] as const).map(([key,label]) => <FormField key={key} label={label} value={quantities[key] ?? ''} type="number" onChange={(value) => { const parsed = inputNumber(value); setIt({ ...it, [key]: parsed ?? 0, quantities: { ...quantities, [key]: parsed } }); }} />)}</div>
        <label className="field">Como definir o total<select aria-label="Como definir o total" value={it.totalMode || 'declarado'} onChange={(event) => set('totalMode', event.target.value)}><option value="declarado">Valor informado</option><option value="calculado">Calcular: volume × preço × frequência</option><option value="ausente">Valor não informado</option></select></label>
        {(it.totalMode || 'declarado') === 'declarado' && <FormField label="Valor total informado" type="number" value={it.valorTotal} onChange={(value) => { const number = inputNumber(value); setIt({ ...it, valorTotal: number ?? 0, totalMode: number == null ? 'ausente' : 'declarado' }); }} />}
        <div className="calc"><span>Total da proposta</span><strong>{total == null ? 'Não informado' : brl(total)}</strong></div><p className="small muted">Total calculado: {calculated == null ? 'dados insuficientes' : brl(calculated)}. O total informado é preservado até você escolher recalcular.</p>
      </section>
      <section className="sheet-section"><h2>Cenário e justificativa</h2><div className="grid g2"><SelectField label="Cenário do item" value={it.classificacaoCenario} options={['NÃO INFORMADO','LIMIAR','INCREMENTAL']} onChange={(value) => set('classificacaoCenario', value as Cenario)} /><SelectField label="Novo item?" value={it.novo ? 'Sim' : 'Não'} options={['Sim','Não']} onChange={(value) => set('novo', value === 'Sim')} /></div><FormField label="Descrição do cenário" textarea value={it.descricaoCenario} onChange={(value) => set('descricaoCenario', value)} /><div className="grid g2"><FormField label="Benefício ao fazer" textarea value={it.beneficioAoFazer} onChange={(value) => set('beneficioAoFazer', value)} /><FormField label="Risco de não fazer" textarea value={it.riscoNaoFazer} onChange={(value) => set('riscoNaoFazer', value)} /></div><div className="grid g3">{(['prioridadeN3','prioridadeN2','prioridadeN1'] as const).map((key) => <FormField key={key} label={key.replace('prioridade','Prioridade ')} type="number" value={it[key]} disabled={limiar} onChange={(value) => set(key, num(value))} />)}</div><FormField label="Observações" textarea value={it.observacoes} onChange={(value) => set('observacoes', value)} /></section>
    </fieldset>
    {it.validationNeedsReview && <p className="alert warn">A decisão anterior foi preservada para conferência ({it.cotaAprovada ? 'aprovada' : 'não aprovada'}). Confirme a cota após revisar o vínculo e a análise.</p>}
    {!!it.source && <details className="reference-panel"><summary>Origem do item e valores importados</summary><p>{it.source.file || 'Arquivo não identificado'} · {it.source.sheet || 'Aba não identificada'} · linha {it.source.row || 'não identificada'}</p><div className="table-wrap"><table className="dt"><tbody>{[['UO original',it.source.unitLabel],['Programa original',it.source.programLabel],['Ação original',it.source.actionLabel],['Exercício original',it.source.exercise],['Total declarado original',it.source.numbers.valorTotal],['Parecer DCMEFO original',it.parecerDcmefoOriginal],['Deliberação COFIN original',it.deliberacaoCofinOriginal]].map(([label,value]) => <tr key={String(label)}><th>{String(label)}</th><td>{value == null || value === '' ? 'Não informado' : String(value)}</td></tr>)}</tbody></table></div>{!!it.dataIssues?.length && <ul>{it.dataIssues.map((message) => <li key={message}>{message}</li>)}</ul>}</details>}
  </Modal>;
}
function CenariosTab({ items }: { items: BudgetItemOBZ[] }) {
  const [fCen, setFCen] = useState(''); const [fGrupo, setFGrupo] = useState('');
  const filtered = items.filter((b) => (!fCen || b.classificacaoCenario === fCen) && (!fGrupo || b.grupo === fGrupo));
  const grupos = Array.from(new Set(items.map((b) => b.grupo)));
  const groupBy = (key: (b: BudgetItemOBZ) => string) => {
    const m: Record<string, number> = Object.create(null); for (const b of filtered) m[key(b)] = (m[key(b)] || 0) + b.valorTotal; return m;
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
        <Bars title="Total por ação" data={groupBy((b) => formatUnitLabel(b.unidadeOrcamentaria) + ' · ' + b.acaoLabel)} />
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
    const w: string[] = budgetItemIssues(b);
    if (!b.acaoLabel) w.push('sem ação'); if (!b.grupo) w.push('sem grupo'); if (!b.elementoItem) w.push('sem elemento-item');
    if (!b.agrupamento) w.push('sem agrupamento'); if (!b.fonte) w.push('sem fonte'); if (!b.descricao) w.push('sem descrição');
    if (b.volume <= 0 || b.precoUnitario <= 0 || b.frequenciaPagamento <= 0) w.push('volume/preço/frequência inválidos');
    if (b.classificacaoCenario === 'LIMIAR' && !b.riscoNaoFazer) w.push('limiar sem risco de não fazer');
    if (b.classificacaoCenario === 'INCREMENTAL' && !b.beneficioAoFazer) w.push('incremental sem benefício');
    if (b.novo && !b.descricaoCenario) w.push('novo sem descrição do cenário');
    return w;
  };
  const allIssues: Issue[] = budgetPriorityIssues(items).map((text) => ({ level: 'err', text }));
  for (const b of items) { const w = itemIssues(b); if (w.length) allIssues.push({ level: 'err', text: `${b.descricao.slice(0, 40)}: ${w.join(', ')}.` }); }

  const setStatusAll = (st: BudgetItemOBZ['statusValidacao'], aviso: string) => {
    const selected = new Set(items.map((item) => item.id));
    update((s) => { for (const b of s.budgetItems) if (selected.has(b.id) && b.linkage?.status === 'vinculado') b.statusValidacao = st; });
  };
  const setItemValidation = (id: string, k: keyof BudgetItemOBZ, v: any) => update((s) => {
    const b = s.budgetItems.find((x) => x.id === id);
    if (b) { (b as any)[k] = v; if (k === 'cotaAprovada') b.validationNeedsReview = false; }
  });
  const dcmefoCanEdit = can('validarDcmefo') || state.perfil === 'Administrador';

  return (
    <>
      <Card title="Pendências por item"><ValidationPanel issues={allIssues.length ? allIssues.slice(0, 50) : [{ level: 'ok', text: 'Nenhuma pendência encontrada nos itens.' }]} /></Card>
      <Card title="Fluxo de validação (N3 · N2 · N1 · DCMEFO)"
        actions={items[0] ? <StatusBadge status={items[0].statusValidacao} /> : undefined}
        lead="N2 pode retornar ao N3; N1 pode retornar ao N2. Depois da aprovação N1, apenas DCMEFO/SEPLAG ou Administrador devolve ao órgão.">
        <div className="row">
          <ActionButton color="blue" icon={<Send size={16} />} disabled={!items.length || !can('enviarValidacao') || allIssues.length > 0} onClick={() => { setStatusAll('ENVIADO PARA VALIDAÇÃO', 'OBZ enviada pelo N3 para validação.'); toast('Enviado para validação.', 'ok'); }}>N3 enviar</ActionButton>
          <ActionButton color="green" icon={<CheckCircle2 size={16} />} disabled={!items.length || allIssues.length > 0 || !can('validarOrgao')} onClick={() => { setStatusAll('VALIDADO PELO ÓRGÃO', 'Aprovação N2 registrada. O item segue para análise N1.'); toast('Aprovação N2 registrada.', 'ok'); }}>N2 aprovar</ActionButton>
          <ActionButton color="green" icon={<CheckCircle2 size={16} />} disabled={!items.length || allIssues.length > 0 || !can('validarOrgao')} onClick={() => { setStatusAll('VALIDADO PELO ÓRGÃO', 'Aprovação N1 registrada. A partir deste ponto, retorno ao órgão apenas por DCMEFO/SEPLAG ou Administrador.'); toast('Aprovação N1 registrada.', 'ok'); }}>N1 aprovar e fechar órgão</ActionButton>
          <ActionButton color="green" icon={<CheckCircle2 size={16} />} disabled={!items.length || allIssues.length > 0 || !can('validarDcmefo')} onClick={() => { setStatusAll('VALIDADO DCMEFO/SEPLAG', 'DCMEFO/SEPLAG aprovou a OBZ. Cotas aprovadas podem ser consolidadas.'); toast('Validado pela DCMEFO/SEPLAG.', 'ok'); }}>DCMEFO aprovar</ActionButton>
          <ActionButton color="red" icon={<RotateCcw size={16} />} disabled={!can('devolver')} onClick={() => { setStatusAll('DEVOLVIDO PARA AJUSTES', can('validarDcmefo') ? 'DCMEFO/SEPLAG devolveu ao órgão para ajuste.' : 'Devolução registrada para o nível anterior.'); toast('Devolvido para ajustes.', 'ok'); }}>Devolver</ActionButton>
        </div>
        {allIssues.length > 0 && <div className="alert warn" style={{ marginTop: 12 }}>Resolva as pendências dos itens antes de enviar para validação.</div>}
      </Card>
      <Card title="Validação de cota pela DCMEFO" lead="Apenas DCMEFO/SEPLAG e Administrador deveriam interagir aqui. Quando a cota não for aprovada, registre motivo e comentário específico por item OBZ.">
        <DataTable<BudgetItemOBZ> rows={items} pageSize={25} searchLabel="Pesquisar cotas OBZ" columns={[
          { key:'descricao', header:'Item OBZ', render:(item)=><div><strong>{item.descricao || 'Item sem descrição'}</strong><div className="small muted">{formatUnitLabel(item.unidadeOrcamentaria)} · {item.elementoItem}</div></div> },
          { key:'valorTotal', header:'Valor', num:true, render:money },
          { key:'cota', header:'Cota', render:(item)=><select aria-label={'Cota: '+item.descricao} value={item.validationNeedsReview || item.linkage?.status !== 'vinculado' || item.cotaAprovada == null ? '' : item.cotaAprovada ? 'sim' : 'nao'} disabled={!dcmefoCanEdit || item.linkage?.status !== 'vinculado'} onChange={(event)=>setItemValidation(item.id,'cotaAprovada',event.target.value === '' ? undefined : event.target.value === 'sim')} style={cellInput}><option value="">{item.validationNeedsReview ? 'Conferir decisão anterior' : 'Em análise'}</option><option value="sim">Aprovada</option><option value="nao">Não aprovada</option></select> },
          { key:'motivo', header:'Motivo', render:(item)=><select aria-label={'Motivo: '+item.descricao} value={item.motivoValidacao || ''} disabled={!dcmefoCanEdit || item.linkage?.status !== 'vinculado'} onChange={(event)=>setItemValidation(item.id,'motivoValidacao',event.target.value)} style={cellInput}><option value="">Selecionar motivo</option>{motivos.map((motivo)=><option key={motivo}>{motivo}</option>)}</select> },
          { key:'observacoes', header:'Comentário', render:(item)=><input aria-label={'Comentário: '+item.descricao} value={item.observacoes || ''} disabled={!dcmefoCanEdit || item.linkage?.status !== 'vinculado'} onChange={(event)=>setItemValidation(item.id,'observacoes',event.target.value)} style={cellInput}/> },
        ]} />
      </Card>
    </>
  );
}

const cellInput: CSSProperties = { border: '1px solid #d4dde3', borderRadius: 7, padding: '5px 7px', fontSize: 12, width: '100%', minWidth: 120 };
