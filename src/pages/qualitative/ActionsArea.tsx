import { useState } from 'react';
import type { Program, OfficialFields } from '../../types';
import { useApp } from '../../store/AppStore';
import { Card, ActionButton, FormField, Tabs } from '../../components/ui';
import { ImportedReference, SituationBadge } from '../../components/PlanningFields';
import { CatalogField, SheetIndex, SheetSection, ProposalOrigin, PendingFields } from '../../components/ProposalForm';
import { normalizeCode, stableLocalId } from '../../services/planningDomain';
import { draftAction, applyActionFields, actionPending, restoreAction } from '../../services/proposalDomain';
import { LocalizersSection } from './LocalizersSection';
import { ImplementationArea } from './ImplementationArea';
import { ProposalActions, RestoreProposal, ExclusionProposal } from '../../components/ProposalActions';
import { SearchableSelect } from '../../components/SearchableSelect';
import { canEditRecord, canDraftRecord, editingContext, fieldRule } from '../../services/editingPolicy';
import { changeSituation } from '../../services/proposalEditing';
import { AssociationProposal } from '../../components/AssociationProposal';

const SECTIONS = [
  { id: 'acao-identificacao', label: 'Identificação e classificações' }, { id: 'acao-responsabilidade', label: 'Responsabilidade' },
  { id: 'acao-finalidade', label: 'Finalidade, descrição e público-alvo' }, { id: 'acao-produto', label: 'Produto' }, { id: 'acao-base', label: 'Base legal' },
];

export function ActionsArea({ program }: { program: Program }) {
  const { state, reference, update, can } = useApp();
  const records = state.actions.filter((record) => record.programaId === program.id);
  const [selected, setSelected] = useState(records.find((record) => normalizeCode(record.codigo) === '1082' && normalizeCode(record.codigoUnidadeOrcamentaria) === '1221')?.id || records[0]?.id || '');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState('ficha');
  const [restore, setRestore] = useState(false);
  const [showList, setShowList] = useState(false);
  const action = records.find((record) => record.id === selected) || records[0];
  const editable = action ? canEditRecord(state, 'action', action) : can('editMapa');
  const locked = (field: string) => !action || !fieldRule('action', field, editingContext(state, 'action', action)).editable;
  const filtered = records.filter((record) => [record.codigo, record.nome, record.unidadeOrcamentaria].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pageCount - 1);
  const add = () => {
    const id = stableLocalId('acao-local');
    update((draft) => draftAction(draft, program.id, id));
    setSelected(id); setTab('ficha'); setQuery(''); setPage(0); setShowList(false);
  };
  const fields = action?.officialFields || {};
  const baseline = reference.actions.find((record) => record.id === action?.id);
  const setFields = (values: OfficialFields) => update((draft) => applyActionFields(draft, action.id, values, reference));
  const setField = (field: string, value: string) => setFields({ [field]: value });
  return <div className="ppo-sheet">
    <div className="action-picker-row"><SearchableSelect label="Ação" value={action?.id || ''} clearable={false} options={records.map((record) => ({ value: record.id, label: `${record.codigo || 'Sem código oficial'} · UO ${record.codigoUnidadeOrcamentaria || 'não informada'} · ${record.nome || 'Ação em rascunho'}` }))} disabled={!records.length} onChange={(id) => { setSelected(id); setTab('ficha'); }} /><ActionButton sm color="ghost" aria-expanded={showList} onClick={() => setShowList(!showList)}>{showList ? 'Ocultar lista de ações' : 'Ver lista de ações'} ({records.length})</ActionButton><ActionButton sm disabled={!canDraftRecord(state)} onClick={add}>Rascunhar ação</ActionButton></div>
    {showList && <Card>
      <FormField label="Pesquisar ações do programa" value={query} onChange={(value) => { setQuery(value); setPage(0); }} />
      <div className="table-wrap"><table className="dt action-records"><thead><tr><th>Código</th><th>Título da Ação</th><th>UO responsável</th><th>Origem / situação</th><th>Ficha</th></tr></thead><tbody>{filtered.slice(currentPage * 15, (currentPage + 1) * 15).map((record) => <tr key={record.id} className={record.id === action?.id ? 'selected-record' : ''}><td>{record.codigo || 'Sem código oficial'}</td><td>{record.nome || 'Ação em rascunho'}</td><td>{record.unidadeOrcamentaria || 'Não informada'}</td><td>{record.source?.origin === 'local' ? <span className="badge purple">Rascunho local</span> : <SituationBadge value={record.officialFields?.['Exclusão Lógica da Ação']} />}</td><td><ActionButton sm color="ghost" aria-pressed={record.id === action?.id} aria-label={`Selecionar ação ${record.codigo || 'sem código'} · UO ${record.codigoUnidadeOrcamentaria || 'não informada'} · ${record.nome || 'rascunho'}`} onClick={() => { setSelected(record.id); setTab('ficha'); }}>Selecionar</ActionButton></td></tr>)}</tbody></table></div>
      {!filtered.length && <p className="small muted">{records.length ? 'Nenhuma ação corresponde à pesquisa.' : 'Nenhuma ação vinculada. Rascunhe uma ação sem precisar preencher código oficial.'}</p>}
      <div className="row pagination"><span>{filtered.length} ações · página {currentPage + 1} de {pageCount}</span><ActionButton sm color="ghost" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Ações anteriores</ActionButton><ActionButton sm color="ghost" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Próximas ações</ActionButton></div>
    </Card>}
    {action && <Card>
      <div className="sheet-toolbar"><Tabs tabs={[{ id: 'ficha', label: 'Ficha da ação' }, { id: 'implementacao', label: 'Implementação e complementos' }, { id: 'territorio', label: 'Localizadores e território' }, ...(tab === 'exclusao' ? [{ id: 'exclusao', label: 'Justificativa de exclusão' }] : [])]} active={tab} onChange={setTab} />
      <ProposalActions record={action} position="início" editable={editable} onRestore={baseline ? () => setRestore(true) : undefined} onExclude={baseline ? () => setTab('exclusao') : undefined} metadata={<><ProposalOrigin record={action} baseline={baseline} /><SituationBadge value={fields['Exclusão Lógica da Ação']} /><PendingFields fields={actionPending(action)} /></>} /></div>
      {tab === 'ficha' && <>
      <SheetIndex items={SECTIONS} />
      <SheetSection id="acao-identificacao" title="Identificação, programa vinculado e classificações">
        <div className="action-id-fields"><FormField label="Código da Ação" value={action.codigo} disabled={locked('Código da Ação')} hint={action.codigo ? undefined : 'Sem código oficial. Você pode preencher posteriormente.'} onChange={(value) => setField('Código da Ação', value)} /><FormField label="Título da Ação" value={action.nome} disabled={!editable} onChange={(value) => setField('Título da Ação', value)} /></div>
        <div className="grid g2">{[
          ['Função', 'Código da Função'], ['Subfunção', 'Código da Subfunção'], ['Tipo de Ação', 'Código do Tipo de Ação'],
          ['Identificador de Ação Governamental (IAG)', 'Código do Identificador de Ação Governamental (IAG)'], ['Projeto Estratégico', 'Código do Projeto Estratégico'],
          ['Área Temática', 'Código da Área Temática'],
        ].map(([label, code]) => <CatalogField key={label} label={label} names={[code, label]} fields={fields} disabled={locked(label)} hint={label === 'Tipo de Ação' ? `${fieldRule('action', label, editingContext(state, 'action', action)).source}: ${fieldRule('action', label, editingContext(state, 'action', action)).reason} Salvar um rascunho local não conclui cadastro no PPO.` : undefined} onChange={setFields} />)}</div>
        <div className="grid g2"><CatalogField label="Setor de Governo" names={['Setor de Governo']} fields={fields} disabled={!editable} onChange={setFields} /><CatalogField label="Política para mulheres" names={['Política para mulheres']} fields={fields} disabled={!editable} onChange={setFields} /></div>
      </SheetSection>
      <SheetSection id="acao-responsabilidade" title="UO e unidade administrativa responsável">
        <CatalogField label="Unidade Orçamentária Responsável pela Ação" names={['Código da Unidade Orçamentária Responsável pela Ação', 'Unidade Orçamentária Responsável pela Ação']} fields={fields} disabled={locked('Código da Unidade Orçamentária Responsável pela Ação')} onChange={setFields} />
        <FormField label="Unidade Administrativa Responsável pela Ação" value={action.unidadeAdministrativa || ''} disabled={!editable} onChange={(value) => setField('Unidade Administrativa Responsável pela Ação', value)} />
        <AssociationProposal record={action} editable={editable} />
      </SheetSection>
      <SheetSection id="acao-finalidade" title="Finalidade, descrição e público-alvo">
        <div className="grid g2"><FormField label="Finalidade da Ação" textarea value={action.finalidade} disabled={!editable} hint="Que situação a ação pretende alcançar, melhorar ou preservar?" onChange={(value) => setField('Finalidade da Ação', value)} />
        <FormField label="Descrição da Ação" textarea value={action.descricao} disabled={!editable} hint="Como a ação pretende atuar?" onChange={(value) => setField('Descrição da Ação', value)} /></div>
        <CatalogField label="Público-Alvo" names={['Código do Público-alvo', 'Público-Alvo']} fields={fields} disabled={!editable} onChange={setFields} />
      </SheetSection>
      <SheetSection id="acao-produto" title="Produto, especificação e unidade de medida">
        <CatalogField label="Produto" names={['Código do Produto', 'Produto']} fields={fields} disabled={!editable} onChange={setFields} />
        <FormField label="Especificação do Produto" textarea value={action.especificacaoProduto} disabled={!editable} hint="O que caracteriza a entrega desta ação?" onChange={(value) => setField('Especificação do Produto', value)} />
        <CatalogField label="Unidade de Medida do Produto" names={['Código da Unidade de Medida do Produto', 'Unidade de Medida do Produto']} fields={fields} disabled={!editable} onChange={setFields} />
      </SheetSection>
      <SheetSection id="acao-base" title="Base legal"><FormField label="Base legal" textarea value={action.baseLegal} disabled={!editable} onChange={(value) => setField('Base legal', value)} /></SheetSection>
      <ImportedReference fields={baseline?.officialFields} proposal={fields} />
      {(baseline?.sourceVariants?.length || 0) > 1 && <details className="reference-panel"><summary>Variantes divergentes ({baseline!.sourceVariants!.length})</summary>{baseline!.sourceVariants!.map((variant, index) => <ImportedReference key={index} fields={variant} />)}</details>}
      </>}
      {tab === 'implementacao' && <ImplementationArea key={action.id} action={action} editable={editable} />}
      {tab === 'territorio' && <LocalizersSection key={action.id} action={action} />}
      {tab === 'exclusao' && baseline && <ExclusionProposal record={action} editable={editable} onChange={(value) => setField('Justificativa de Inclusão ou Exclusão da Ação', value)} onConfirm={() => update((draft) => changeSituation(draft, reference, 'action', action.id, true, fields['Justificativa de Inclusão ou Exclusão da Ação']))} />}
      <ProposalActions record={action} position="final" editable={editable} onRestore={baseline ? () => setRestore(true) : undefined} onExclude={baseline ? () => setTab('exclusao') : undefined} />
    </Card>}
    {restore && action && <RestoreProposal onClose={() => setRestore(false)} onConfirm={() => { update((draft) => restoreAction(draft, reference, action.id)); setRestore(false); setTab('ficha'); }} />}
  </div>;
}
