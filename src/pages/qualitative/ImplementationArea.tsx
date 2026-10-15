import { useState } from 'react';
import type { Action, ActionComplements } from '../../types';
import { useApp } from '../../store/AppStore';
import { ActionButton, FormField } from '../../components/ui';
import { stableLocalId } from '../../services/planningDomain';
import { HelpTip } from '../../components/HelpTip';

const emptyLocal = (): ActionComplements => ({ atividades: [], criterioEntrega: '', evidenciaEntrega: '', parceirosCondicoes: '', distribuicaoTerritorial: '', papelLocalizador: '', criteriosTerritoriais: '', condicoesTerritoriais: '' });
const TERRITORIAL_FIELDS = [['distribuicaoTerritorial', 'Como a atuação se distribui no território'], ['papelLocalizador', 'O local registrado representa execução, público atendido ou outra referência?'], ['criteriosTerritoriais', 'Critérios de seleção ou priorização territorial'], ['condicoesTerritoriais', 'Condições ou parcerias necessárias à execução nesses territórios']] as const;

export function ImplementationArea({ action, editable }: { action: Action; editable: boolean }) {
  const { update } = useApp();
  const [activity, setActivity] = useState('');
  const [title, setTitle] = useState('');
  const [newStage, setNewStage] = useState('');
  const setAction = (apply: (record: Action) => void) => update((draft) => apply(draft.actions.find((record) => record.id === action.id)!));
  const setLocal = (field: keyof ActionComplements, value: string) => setAction((record) => { record.local ||= emptyLocal(); (record.local[field] as string) = value; });
  const stages = action.local?.etapasImplementacao || [];
  return <section className="implementation-area">
    <FormField label="Detalhamento da Implementação (complemento local)" textarea value={action.detalhamentoImplementacao || ''} disabled={!editable} onChange={(value) => setAction((record) => { record.detalhamentoImplementacao = value; })} hint="Descreva como a ação será implementada. Os temas abaixo são opcionais e podem ser registrados separadamente." />
    <div className="implementation-stage-builder"><div className="sheet-section-heading"><h3>Etapas e temas da implementação</h3><HelpTip label="Ajuda: etapas da implementação" text="Complementos locais opcionais: preparação, articulação, execução, atendimento, logística, entrega ou acompanhamento. Você define os temas, sem uma sequência obrigatória." /></div>
      <div className="row"><FormField label="Nome da etapa ou tema" value={title} disabled={!editable} onChange={setTitle} placeholder="Ex.: Articulação com parceiros" /><ActionButton disabled={!editable || !title.trim()} onClick={() => { const id = stableLocalId('etapa-local'); setAction((record) => { record.local ||= emptyLocal(); record.local.etapasImplementacao ||= []; record.local.etapasImplementacao.push({ id, titulo: title.trim(), descricao: '', responsaveis: '', condicoes: '', evidencias: '' }); }); setNewStage(id); setTitle(''); }}>Adicionar etapa ou tema</ActionButton></div>
      {!stages.length && <p className="small muted">Nenhuma etapa ou tema acrescentado.</p>}
      {stages.map((stage, index) => <details className="implementation-group" key={stage.id} open={stage.id === newStage}><summary>{stage.titulo || `Etapa ${index + 1}`} <span className="badge purple">Local</span></summary>
        <FormField label={`Nome da etapa ${index + 1}`} value={stage.titulo} disabled={!editable} onChange={(value) => setAction((record) => { record.local!.etapasImplementacao!.find((item) => item.id === stage.id)!.titulo = value; })} />
        <div className="grid g2">{([['descricao', 'O que acontece nesta etapa ou tema'], ['responsaveis', 'Responsáveis e parceiros'], ['condicoes', 'Condições, dependências e riscos'], ['evidencias', 'Entregas, evidências e acompanhamento']] as const).map(([field, label]) => <FormField key={field} label={`${label} — ${index + 1}`} textarea value={stage[field]} disabled={!editable} onChange={(value) => setAction((record) => { record.local!.etapasImplementacao!.find((item) => item.id === stage.id)![field] = value; })} />)}</div>
        <ActionButton color="ghost" sm disabled={!editable} onClick={() => setAction((record) => { record.local!.etapasImplementacao = record.local!.etapasImplementacao!.filter((item) => item.id !== stage.id); })}>Remover etapa {index + 1}</ActionButton>
      </details>)}
    </div>
    <details className="implementation-group"><summary>Atividades, critérios de entrega, evidências e parceiros</summary>
      {(action.local?.atividades || []).map((record, index) => <div key={record.id} className="editable-activity"><FormField label={`Atividade principal ${index + 1}`} textarea value={record.texto} disabled={!editable} onChange={(value) => setAction((target) => { target.local!.atividades.find((candidate) => candidate.id === record.id)!.texto = value; })} /><ActionButton color="ghost" disabled={!editable} onClick={() => setAction((target) => { target.local!.atividades = target.local!.atividades.filter((candidate) => candidate.id !== record.id); })}>Remover atividade {index + 1}</ActionButton></div>)}
      <div className="row"><FormField label="Nova atividade principal" value={activity} disabled={!editable} onChange={setActivity} /><ActionButton disabled={!editable || !activity.trim()} onClick={() => { setAction((target) => { target.local ||= emptyLocal(); target.local.atividades.push({ id: stableLocalId('atividade-local'), texto: activity.trim() }); }); setActivity(''); }}>Adicionar atividade</ActionButton></div>
      {([['criterioEntrega', 'Critério para considerar o produto entregue'], ['evidenciaEntrega', 'Evidência ou registro que comprova a entrega'], ['parceirosCondicoes', 'Parceiros e condições relevantes para execução']] as const).map(([field, label]) => <FormField key={field} label={label} textarea value={action.local?.[field] || ''} disabled={!editable} onChange={(value) => setLocal(field, value)} />)}
    </details>
    <details className="implementation-group"><summary>Território e condições locais</summary>
      <div className="grid g2">{TERRITORIAL_FIELDS.map(([field, label]) => <FormField key={field} label={label} textarea value={action.local?.[field] || ''} disabled={!editable} onChange={(value) => setLocal(field, value)} hint={field === 'papelLocalizador' ? 'O município cadastrado não define, sozinho, toda a população beneficiada.' : undefined} />)}</div>
      <ActionButton color="ghost" disabled={!editable || !TERRITORIAL_FIELDS.some(([field]) => action.local?.[field]?.trim())} onClick={() => setAction((target) => { const parts = TERRITORIAL_FIELDS.map(([field]) => target.local?.[field]).filter(Boolean); if (parts.length) target.detalhamentoImplementacao = [target.detalhamentoImplementacao, `Esclarecimentos territoriais (complemento local):\n${parts.join('\n')}`].filter(Boolean).join('\n\n'); })}>Acrescentar esclarecimentos ao Detalhamento da Implementação</ActionButton>
    </details>
  </section>;
}
