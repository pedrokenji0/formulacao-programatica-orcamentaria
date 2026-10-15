import { useMemo, useState } from 'react';
import type { Action, PlanningLocalizer, TerritorialRelation } from '../../types';
import { useApp } from '../../store/AppStore';
import { Card, FormField, SelectField, ActionButton, Modal } from '../../components/ui';
import { ImportedReference, SituationBadge } from '../../components/PlanningFields';
import { proposedLocalizer, situation } from '../../services/planningDomain';
import { draftLocalizer } from '../../services/proposalDomain';
import { CatalogField } from '../../components/ProposalForm';
import { stableLocalId } from '../../services/planningDomain';
import { canEditRecord } from '../../services/editingPolicy';
import { RecordOperations } from '../../components/RecordOperations';

const TERRITORY_FIELDS = ['Código da Região Geográfica Intermediária', 'Região Geográfica Intermediária', 'Código do Município IBGE', 'Código do Município Sigplan', 'Município'];
export function LocalizersSection({ action }: { action: Action }) {
  const { state, reference, update, can } = useApp();
  const [municipality, setMunicipality] = useState('');
  const [region, setRegion] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState('');
  const [page, setPage] = useState(0);
  const editable = canEditRecord(state, 'action', action);
  const baseline = useMemo(() => reference.localizers.filter((record) => record.actionId === action.id), [reference, action.id]);
  const territoryCatalog = useMemo(() => reference.localizers.flatMap((record) => record.territories.map((territory) => territory.fields)), [reference]);
  const records = [...baseline, ...Object.values(state.planning?.localizerProposals || {}).filter((record) => record.actionId === action.id && !baseline.some((original) => original.id === record.id))];
  const rows = records.flatMap((record) => {
    const proposal = proposedLocalizer(state, record);
    return proposal.territories.map((territory) => ({ localizer: proposal, territory, baseline: record, excluded: proposal.exclusionProposal !== undefined ? proposal.exclusionProposal ? 'Sim' : 'Não' : proposal.fields['Exclusão Lógica do Localizador'] !== record.fields['Exclusão Lógica do Localizador'] ? proposal.fields['Exclusão Lógica do Localizador'] : territory.statusFields['Exclusão Lógica do Localizador'] }));
  });
  const filtered = rows.filter((row) => (!municipality || row.territory.fields.Município.toLocaleLowerCase('pt-BR').includes(municipality.toLocaleLowerCase('pt-BR'))) && (!region || row.territory.fields['Região Geográfica Intermediária'] === region) && (!status || situation(row.excluded) === status));
  const regions = [...new Set(rows.map((row) => row.territory.fields['Região Geográfica Intermediária']))].filter(Boolean).sort();
  const selectedRow = rows.find((row) => row.territory.id === selected);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pageCount - 1);
  const change = (apply: (record: PlanningLocalizer, territory: TerritorialRelation) => void) => {
    if (!selectedRow) return;
    update((draft) => {
      const target = draft.planning!.localizerProposals[selectedRow.localizer.id] ||= structuredClone(selectedRow.localizer);
      apply(target, target.territories.find((territory) => territory.id === selectedRow.territory.id)!);
    });
  };
  const add = () => { const id = stableLocalId('localizador-local'); const territoryId = stableLocalId('territorio-local'); update((draft) => draftLocalizer(draft, draft.actions.find((record) => record.id === action.id)!, id, territoryId)); setSelected(territoryId); };
  return <Card title="Cadastro territorial" count={rows.length} lead="Códigos IBGE e Sigplan são distintos; campos vazios e referências especiais são preservados." actions={<ActionButton disabled={!editable} onClick={() => { const id = stableLocalId('localizador-local'); const territoryId = stableLocalId('territorio-local'); update((draft) => draftLocalizer(draft, draft.actions.find((record) => record.id === action.id)!, id, territoryId)); setSelected(territoryId); }}>Rascunhar localizador</ActionButton>}>
    <div className="grid g3"><FormField label="Filtrar por município" value={municipality} onChange={(value) => { setMunicipality(value); setPage(0); }} /><SelectField label="Filtrar por região" value={region} options={regions} onChange={(value) => { setRegion(value); setPage(0); }} placeholder="Todas as regiões" /><SelectField label="Filtrar por situação do localizador" value={status} options={['Ativo', 'Excluído', 'Não informado']} onChange={(value) => { setStatus(value); setPage(0); }} placeholder="Todas as situações" /></div>
    <div className="table-wrap"><table className="dt territorial-table"><thead><tr><th>Código do localizador</th><th>Região Geográfica Intermediária</th><th>Município</th><th>Código IBGE</th><th>Código Sigplan</th><th>Situação cadastral</th><th>Registro</th></tr></thead><tbody>
      {filtered.slice(currentPage * 25, (currentPage + 1) * 25).map((row) => <tr key={row.territory.id} className={situation(row.excluded) === 'Excluído' ? 'excluded-record' : ''}>
        <td>{row.localizer.fields['Código do Localizador'] || 'Sem código oficial'}</td><td>{row.territory.fields['Região Geográfica Intermediária'] || 'Não informado'}</td><td>{row.territory.fields.Município || 'Não informado'}</td><td>{row.territory.fields['Código do Município IBGE'] || 'Não informado'}</td><td>{row.territory.fields['Código do Município Sigplan'] || 'Não informado'}</td><td>{row.localizer.origin === 'local' && <span className="badge purple">Rascunho local</span>}<SituationBadge value={row.excluded} /></td><td><ActionButton sm color="ghost" onClick={() => setSelected(row.territory.id)}>Detalhes {row.localizer.fields['Código do Localizador'] || 'sem código'}</ActionButton></td>
      </tr>)}
    </tbody></table></div>
    {!filtered.length && <div className="empty">Nenhum localizador encontrado para esta ação e os filtros selecionados.</div>}
    <div className="row pagination"><span>{filtered.length} relações territoriais · página {currentPage + 1} de {pageCount}</span><ActionButton sm color="ghost" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Anterior</ActionButton><ActionButton sm color="ghost" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Próxima</ActionButton></div>
    {selectedRow && <Modal wide title={`Localizador ${selectedRow.localizer.fields['Código do Localizador'] || 'sem código oficial'}`} sub={selectedRow.localizer.origin === 'local' ? 'Novo localizador em rascunho · sem registro oficial anterior' : 'Proposta local · referência territorial original preservada'} onClose={() => setSelected('')}>
      <div className="row"><SituationBadge label="Programa na base territorial: " value={selectedRow.territory.statusFields['Exclusão Lógica do Programa']} /><SituationBadge label="Ação na base territorial: " value={selectedRow.territory.statusFields['Exclusão Lógica da Ação']} /><SituationBadge label="Localizador: " value={selectedRow.excluded} /></div>
      <ImportedReference fields={selectedRow.localizer.origin === 'local' ? undefined : { ...selectedRow.baseline.fields, ...selectedRow.baseline.territories.find((territory) => territory.id === selectedRow.territory.id)?.fields }} proposal={{ ...selectedRow.localizer.fields, ...selectedRow.territory.fields }} />
      <FormField label="Código do Localizador" value={selectedRow.localizer.fields['Código do Localizador'] || ''} disabled={!editable || selectedRow.localizer.origin !== 'local'} onChange={(value) => change((record) => { record.fields['Código do Localizador'] = value; })} />
      <div className="row"><RecordOperations kind="localizer" record={selectedRow.localizer} statusValue={selectedRow.excluded} editable={editable} />{selectedRow.localizer.origin !== 'local' && <ActionButton disabled={!editable} onClick={add}>Propor outro localizador</ActionButton>}</div>
      <CatalogField label="Referência territorial" names={TERRITORY_FIELDS} fields={selectedRow.territory.fields} catalogRows={territoryCatalog} disabled={!editable || selectedRow.localizer.origin !== 'local'} onChange={(values) => change((_record, territory) => Object.assign(territory.fields, values))} />
      <dl className="reference-grid">{TERRITORY_FIELDS.map((name) => <div key={name}><dt>{name}</dt><dd>{selectedRow.territory.fields[name] || 'Não informado'}</dd></div>)}</dl>
      <details><summary>Classificações e vínculos registrados na base territorial</summary><dl className="reference-grid">{Object.entries(selectedRow.localizer.fields).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Campo vazio na base'}</dd></div>)}</dl></details>
    </Modal>}
  </Card>;
}
