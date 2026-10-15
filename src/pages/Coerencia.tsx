import { useState } from 'react';
import { useApp } from '../store/AppStore';
import { Card, Tabs, ActionButton, useToast, brl } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { ValidationPanel, type Issue } from '../components/ValidationPanel';
import { CoherenceScore } from '../components/CoherenceScore';
import type { BudgetItemOBZ, CoherenceLink, ProcessAction, ProcessMap, CoherenceStatus } from '../types';
import { Save, ArrowRight, Coins, Boxes, Activity, Package, Target, TrendingUp, Info } from 'lucide-react';

function matchAction(map: ProcessMap | undefined, b: BudgetItemOBZ): ProcessAction | undefined {
  if (!map) return undefined;
  if (b.actionId) return map.actions.find((action) => (action.catalogActionId || action.id) === b.actionId);
  const code = (b.acaoLabel.match(/^\s*(\w+)/)?.[1]) || '';
  const candidates = map.actions.filter((action) => action.codigo === code);
  return candidates.length === 1 ? candidates[0] : undefined;
}
function linkStatus(l: Partial<CoherenceLink>): CoherenceStatus {
  if (!l.actionId) return 'Inconsistente';
  const hasActivities = !!l.activityId || !!l.activityIds?.length;
  const hasResources = !!l.resourceId || !!l.resourceIds?.length;
  const hasProducts = !!l.productId || !!l.productIds?.length;
  const rec = hasActivities && hasResources;
  if (rec && hasProducts) return 'Completo';
  if (hasActivities || hasResources) return 'Parcial';
  return 'Pendente';
}
const idsOf = (list: string[] | undefined, single: string | null | undefined) => list?.length ? list : single ? [single] : [];

export function CoerenciaPage({ initialTab }: { initialTab?: string }) {
  const { state } = useApp();
  const [tab, setTab] = useState(initialTab || 'guiada');
  const pid = state.currentProgramId;
  const items = state.budgetItems.filter((b) => b.programaId === pid);
  const map = state.maps.find((m) => m.programId === pid);

  const tabs = [
    { id: 'guiada', label: 'Associação Guiada por Item' },
    { id: 'matriz', label: 'Matriz de Coerência' },
    { id: 'verificacao', label: 'Verificação de Ligações' },
    { id: 'comparativo', label: 'Comparativo Programa x OBZ' },
  ];

  return (
    <>
      <PageHeader crumb="Coerência Programa-OBZ" title="Coerência Programa-OBZ"
        sub="Casamento entre a estrutura programática (cadeia operacional da ação) e os itens orçamentários da OBZ." />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'guiada' && <GuiadaTab items={items} map={map} pid={pid} />}
      {tab === 'matriz' && <MatrizTab items={items} map={map} />}
      {tab === 'verificacao' && <VerificacaoTab items={items} map={map} pid={pid} />}
      {tab === 'comparativo' && <ComparativoTab items={items} map={map} />}
    </>
  );
}

// ---------- Associação Guiada ----------
function GuiadaTab({ items, map, pid }: { items: BudgetItemOBZ[]; map?: ProcessMap; pid: string }) {
  const { state, update, can } = useApp();
  const toast = useToast();
  const [selId, setSelId] = useState(items[0]?.id || '');
  const item = items.find((b) => b.id === selId) || items[0];
  const editable = can('editLinks');

  if (!item) return <Card title="Associação Guiada"><div className="empty">Nenhum item OBZ neste programa. Importe ou crie itens na OBZ.</div></Card>;
  const act = matchAction(map, item);
  const link = state.links.find((l) => l.budgetItemId === item.id) || { id: 'new', budgetItemId: item.id, actionId: act?.id || '', resourceId: null, activityId: null, productId: null, resourceIds: [], activityIds: [], productIds: [], resultId: null, impactId: null, status: 'Pendente' as CoherenceStatus, warnings: [], notes: '' };

  const setLink = (k: keyof CoherenceLink, v: any) => update((s) => {
    let l = s.links.find((x) => x.budgetItemId === item.id);
    if (!l) { l = { id: 'lnk-' + item.id, budgetItemId: item.id, actionId: act?.id || '', resourceId: null, activityId: null, productId: null, resourceIds: [], activityIds: [], productIds: [], resultId: null, impactId: null, status: 'Pendente', warnings: [], notes: '' }; s.links.push(l); }
    (l as any)[k] = v; l.status = linkStatus(l);
  });
  const toggleList = (field: 'resourceIds' | 'activityIds' | 'productIds', singleField: 'resourceId' | 'activityId' | 'productId', id: string) => update((s) => {
    let l = s.links.find((x) => x.budgetItemId === item.id);
    if (!l) { l = { id: 'lnk-' + item.id, budgetItemId: item.id, actionId: act?.id || '', resourceId: null, activityId: null, productId: null, resourceIds: [], activityIds: [], productIds: [], resultId: null, impactId: null, status: 'Pendente', warnings: [], notes: '' }; s.links.push(l); }
    const set = new Set(idsOf((l as any)[field], (l as any)[singleField]));
    if (set.has(id)) set.delete(id); else set.add(id);
    (l as any)[field] = Array.from(set);
    (l as any)[singleField] = (l as any)[field][0] || null;
    l.status = linkStatus(l);
  });

  const opt = (arr: { id: string; texto: string }[]) => arr.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>);
  const nameOf = (arr: { id: string; texto: string }[] | undefined, id: string | null) => arr?.find((x) => x.id === id)?.texto || '—';
  const namesOf = (arr: { id: string; texto: string }[] | undefined, ids: string[]) => ids.map((id) => arr?.find((x) => x.id === id)?.texto).filter(Boolean).join('; ') || '—';

  const steps: any[] = [
    { key: 'actionId', label: 'Ação', badge: 'Obrigatório', icon: <Coins size={16} />, value: act ? `${act.codigo} — ${act.nome}` : '—', fixed: true },
    { key: 'resourceIds', single: 'resourceId', label: 'Recursos reais', badge: 'Obrigatório', icon: <Boxes size={16} />, options: act?.recursos, multi: true },
    { key: 'activityIds', single: 'activityId', label: 'Atividades', badge: 'Obrigatório', icon: <Activity size={16} />, options: act?.atividades, multi: true },
    { key: 'productIds', single: 'productId', label: 'Produtos / entregas', badge: 'Opcional', icon: <Package size={16} />, options: act?.produtos, multi: true },
    { key: 'resultId', label: 'Resultado', badge: 'Recomendado', icon: <Target size={16} />, options: [...(act?.resultados || []), ...(map?.resultados || [])] },
    { key: 'impactId', label: 'Impacto', badge: 'Recomendado', icon: <TrendingUp size={16} />, options: [...(act?.impactos || []), ...(map?.impactos || [])] },
  ];

  const msgs: string[] = [];
  const activityIds = idsOf(link.activityIds, link.activityId);
  const resourceIds = idsOf(link.resourceIds, link.resourceId);
  const productIds = idsOf(link.productIds, link.productId);
  const preProdutos = (act?.atividades || []).filter((a) => activityIds.includes(a.id) && a.preProduto).map((a) => a.preProduto);
  if (activityIds.length) msgs.push('Item vinculado a uma ou mais atividades da ação.');
  if (preProdutos.length) msgs.push(`Pré-produtos associados automaticamente: ${preProdutos.join('; ')}.`);
  if (!resourceIds.length) msgs.push('Selecione ao menos um recurso real associado ao item OBZ.');

  return (
    <div className="guided">
      {/* coluna esquerda */}
      <Card title={<>Itens OBZ <span className="pill-count">{items.length}</span></>}>
        {items.map((b) => (
          <div key={b.id} className={'gitem' + (b.id === item.id ? ' active' : '')} onClick={() => setSelId(b.id)}>
            <div className="gd">{b.descricao.slice(0, 48)}</div>
            <div className="gm"><span className={'badge ' + (b.classificacaoCenario === 'LIMIAR' ? 'limiar' : 'incr')}>{b.classificacaoCenario === 'LIMIAR' ? 'Limiar' : 'Incr'}</span> {brl(b.valorTotal)}</div>
          </div>
        ))}
      </Card>

      {/* centro */}
      <Card title="Fluxo de associação">
        <div style={{ background: '#f7fafc', border: '1px solid var(--line)', borderRadius: 11, padding: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 700 }}>{item.elementoItem || item.descricao}</div>
          <div className="small muted" style={{ marginTop: 4 }}>{item.descricao}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <span className={'badge ' + (item.classificacaoCenario === 'LIMIAR' ? 'limiar' : 'incr')}>{item.classificacaoCenario}</span>
            <span className="badge blue">{brl(item.valorTotal)}</span>
          </div>
          <div className="small" style={{ marginTop: 8 }}><b>Benefício:</b> {item.beneficioAoFazer || '—'}</div>
          <div className="small"><b>Risco de não fazer:</b> {item.riscoNaoFazer || '—'}</div>
        </div>

        {steps.map((st) => (
          <div className="flowstep" key={st.key}>
            <div className="step-ic">{st.icon}</div>
            <div className="grow">
              <label>{st.label} <span className={'badge ' + (st.badge === 'Obrigatório' ? 'red' : st.badge === 'Opcional' ? 'gray' : 'blue')}>{st.badge}</span></label>
              {st.fixed
                ? <div style={{ fontWeight: 600, marginTop: 3 }}>{st.value}</div>
                : st.multi
                  ? <MultiPick options={(st.options as any) || []} selected={idsOf((link as any)[st.key], (link as any)[st.single])} disabled={!editable} onToggle={(id) => toggleList(st.key as any, st.single as any, id)} />
                : <select value={(link as any)[st.key] || ''} disabled={!editable} onChange={(e) => setLink(st.key as keyof CoherenceLink, e.target.value || null)} style={{ width: '100%', marginTop: 4, border: '1px solid #ccd6dc', borderRadius: 8, padding: '7px 9px' }}>
                    <option value="">— não vinculado —</option>{opt((st.options as any) || [])}
                  </select>}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 12 }}>
          {msgs.map((m, i) => <div key={i} className="alert ok" style={{ padding: '7px 11px' }}><Info className="ai" size={15} />{m}</div>)}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <ActionButton color="green" icon={<Save size={16} />} disabled={!editable} onClick={() => toast('Associação salva.', 'ok')}>Salvar associação</ActionButton>
          <ActionButton color="ghost" onClick={() => { const idx = items.findIndex((b) => b.id === item.id); setSelId(items[(idx + 1) % items.length].id); }}>Próximo item →</ActionButton>
          <ActionButton color="red" disabled={!editable} onClick={() => update((s) => { s.links = s.links.filter((l) => l.budgetItemId !== item.id); })}>Limpar vínculos</ActionButton>
        </div>
      </Card>

      {/* direita: mapa-resumo */}
      <Card title="Mapa-resumo da ação">
        {act ? <>
          <div className="kv"><span>Ação</span><span className="v">{act.codigo}</span></div>
          <div className="small muted" style={{ margin: '6px 0' }}>{act.nome}</div>
          <Resumo label="Recursos" v={namesOf(act.recursos, resourceIds)} />
          <Resumo label="Atividades" v={namesOf(act.atividades, activityIds)} />
          <Resumo label="Produto" v={namesOf(act.produtos, productIds)} />
          <Resumo label="Pré-produtos" v={preProdutos.join('; ') || '—'} />
          <Resumo label="Resultado" v={nameOf([...(act.resultados || []), ...(map?.resultados || [])], link.resultId)} />
          <Resumo label="Impacto" v={nameOf([...(act.impactos || []), ...(map?.impactos || [])], link.impactId)} />
          <div className="alert ok" style={{ marginTop: 10 }}>Status do vínculo: <b style={{ marginLeft: 5 }}>{linkStatus(link)}</b></div>
        </> : <div className="empty">Cadastre a ação no Mapa de Processos para associar.</div>}
      </Card>
    </div>
  );
}
function Resumo({ label, v }: { label: string; v: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}><ArrowRight size={13} color="#9aabb5" /><span className="small muted" style={{ width: 70 }}>{label}</span><span className="small" style={{ fontWeight: 600 }}>{v}</span></div>;
}

function MultiPick({ options, selected, disabled, onToggle }: { options: { id: string; texto: string; preProduto?: string }[]; selected: string[]; disabled?: boolean; onToggle: (id: string) => void }) {
  if (!options.length) return <div className="empty" style={{ padding: 10 }}>Nenhuma opção cadastrada no mapa.</div>;
  return (
    <div className="multi-pick">
      {options.map((o) => (
        <label key={o.id} className={selected.includes(o.id) ? 'on' : ''}>
          <input type="checkbox" checked={selected.includes(o.id)} disabled={disabled} onChange={() => onToggle(o.id)} />
          <span>{o.texto}{o.preProduto && <small>pré-produto: {o.preProduto}</small>}</span>
        </label>
      ))}
    </div>
  );
}

// ---------- Matriz ----------
function MatrizTab({ items, map }: { items: BudgetItemOBZ[]; map?: ProcessMap }) {
  const { state } = useApp();
  const linkOf = (id: string) => state.links.find((l) => l.budgetItemId === id);
  const nm = (arr: any[] | undefined, id: string | null | undefined) => arr?.find((x) => x.id === id)?.texto || '—';
  const nms = (arr: any[] | undefined, ids: string[]) => ids.map((id) => nm(arr, id)).filter((x) => x !== '—').join('; ') || '—';
  return (
    <Card title="Matriz de Coerência" lead="Cada item OBZ pode ser vinculado à cadeia operacional da ação (recurso, atividade, produto) e aos resultados/impactos do programa.">
      <DataTable<BudgetItemOBZ> empty="Sem itens OBZ." rows={items} columns={[
        { key: 'descricao', header: 'Item OBZ', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.descricao.slice(0, 40)}</div><div className="small muted">{r.grupo.split(' — ')[0]} · {r.agrupamento} · fonte {r.fonte}</div></div> },
        { key: 'valorTotal', header: 'Valor', num: true, render: (r) => brl(r.valorTotal) },
        { key: 'acao', header: 'Ação', render: (r) => r.acaoLabel.split(' — ')[0] },
        { key: 'rec', header: 'Recursos', render: (r) => { const a = matchAction(map, r); const l = linkOf(r.id); return nms(a?.recursos, idsOf(l?.resourceIds, l?.resourceId)); } },
        { key: 'ativ', header: 'Atividades', render: (r) => { const a = matchAction(map, r); const l = linkOf(r.id); return nms(a?.atividades, idsOf(l?.activityIds, l?.activityId)); } },
        { key: 'prod', header: 'Produtos', render: (r) => { const a = matchAction(map, r); const l = linkOf(r.id); return nms(a?.produtos, idsOf(l?.productIds, l?.productId)); } },
        { key: 'status', header: 'Coerência', render: (r) => { const st = linkOf(r.id) ? linkStatus(linkOf(r.id)!) : 'Pendente'; const c = st === 'Completo' ? 'green' : st === 'Parcial' ? 'orange' : st === 'Inconsistente' ? 'red' : 'gray'; return <span className={'badge ' + c}>{st}</span>; } },
      ]} />
    </Card>
  );
}

// ---------- Verificação ----------
function VerificacaoTab({ items, map, pid }: { items: BudgetItemOBZ[]; map?: ProcessMap; pid: string }) {
  const { state } = useApp();
  const issues: Issue[] = [];
  for (const b of items) {
    const l = state.links.find((x) => x.budgetItemId === b.id);
    if (!idsOf(l?.activityIds, l?.activityId).length) issues.push({ level: 'warn', text: `${b.descricao.slice(0, 36)}: sem atividade vinculada.` });
    if (!idsOf(l?.resourceIds, l?.resourceId).length) issues.push({ level: 'warn', text: `${b.descricao.slice(0, 36)}: sem recurso vinculado.` });
    if (b.classificacaoCenario === 'LIMIAR' && !b.riscoNaoFazer) issues.push({ level: 'err', text: `${b.descricao.slice(0, 36)}: limiar sem risco de não fazer.` });
    if (b.classificacaoCenario === 'INCREMENTAL' && !b.beneficioAoFazer) issues.push({ level: 'err', text: `${b.descricao.slice(0, 36)}: incremental sem benefício.` });
  }
  if (map) for (const a of map.actions) {
    if (a.produtos.length && a.produtos.some((p) => !(p.publicos && p.publicos.length))) issues.push({ level: 'warn', text: `Ação ${a.codigo}: produto sem público-alvo.` });
  }
  const linked = items.filter((b) => state.links.some((l) => l.budgetItemId === b.id && idsOf(l.activityIds, l.activityId).length));
  const progScore = map ? Math.min(100, Math.round((map.actions.filter((a) => a.produtos.length && a.atividades.length).length / Math.max(1, map.actions.length)) * 100)) : 0;
  const orcScore = Math.round((items.filter((b) => b.beneficioAoFazer && (b.classificacaoCenario === 'INCREMENTAL' || b.riscoNaoFazer)).length / Math.max(1, items.length)) * 100);
  const intScore = Math.round((linked.length / Math.max(1, items.length)) * 100);
  const geral = Math.round((progScore + orcScore + intScore) / 3);

  return (
    <>
      <div className="grid g4">
        <Card title="Programática"><CoherenceScore value={progScore} label="Cadeia do programa" /></Card>
        <Card title="Orçamentária"><CoherenceScore value={orcScore} label="Qualidade dos itens" /></Card>
        <Card title="Integração"><CoherenceScore value={intScore} label="Itens vinculados" /></Card>
        <Card title="Geral"><CoherenceScore value={geral} label="Nota geral" /></Card>
      </div>
      <Card title="Alertas automáticos"><ValidationPanel issues={issues.length ? issues : [{ level: 'ok', text: 'Nenhum alerta de ligação.' }]} /></Card>
    </>
  );
}

// ---------- Comparativo ----------
function ComparativoTab({ items, map }: { items: BudgetItemOBZ[]; map?: ProcessMap }) {
  const { state, update } = useApp();
  const [fAcao, setFAcao] = useState('');
  const acoes = Array.from(new Set(items.map((b) => b.acaoLabel)));
  const filtered = items.filter((b) => !fAcao || b.acaoLabel === fAcao);
  const linkOf = (id: string) => state.links.find((l) => l.budgetItemId === id);
  const setNote = (id: string, v: string) => update((s) => { let l = s.links.find((x) => x.budgetItemId === id); if (!l) { l = { id: 'lnk-' + id, budgetItemId: id, actionId: '', resourceId: null, activityId: null, productId: null, resultId: null, impactId: null, status: 'Pendente', warnings: [], notes: '' }; s.links.push(l); } l.notes = v; });

  return (
    <Card title="Comparativo Programa x OBZ"
      actions={<select value={fAcao} onChange={(e) => setFAcao(e.target.value)} style={{ border: '1px solid #ccd6dc', borderRadius: 8, padding: '7px 10px' }}><option value="">Todas as ações</option>{acoes.map((a) => <option key={a} value={a}>{a.slice(0, 30)}</option>)}</select>}
      lead="Quatro colunas: estrutura programática · OBZ · vínculo sugerido · pendência/decisão.">
      <div className="table-wrap">
        <table className="dt">
          <thead><tr><th>Estrutura programática</th><th>OBZ importada/preenchida</th><th>Vínculo sugerido</th><th>Pendência / decisão</th></tr></thead>
          <tbody>
            {filtered.map((b) => {
              const a = matchAction(map, b); const l = linkOf(b.id);
              const sug = a?.atividades[0]?.texto || 'atividade da ação';
              return (
                <tr key={b.id}>
                  <td><b>{a ? a.codigo + ' — ' + a.nome.slice(0, 26) : '—'}</b><div className="small muted">recurso → atividade → produto</div></td>
                  <td>{b.elementoItem}<div className="small muted">{b.agrupamento} · fonte {b.fonte} · {brl(b.valorTotal)} · {b.classificacaoCenario}</div></td>
                  <td>{idsOf(l?.activityIds, l?.activityId).length ? <span className="badge green">vinculado</span> : <span className="small">sugerir: <b>{sug}</b></span>}</td>
                  <td><input value={l?.notes || ''} placeholder="aceitar / editar / parâmetro externo..." onChange={(e) => setNote(b.id, e.target.value)} style={{ border: '1px solid #d4dde3', borderRadius: 7, padding: '5px 7px', fontSize: 12, width: '100%', minWidth: 140 }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
