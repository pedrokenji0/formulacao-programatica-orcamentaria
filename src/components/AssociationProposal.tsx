import { useState } from 'react';
import type { Program, Action, OfficialFields } from '../types';
import { useApp } from '../store/AppStore';
import { unitNames, linkedRecords } from '../services/editingPolicy';
import { proposeAssociation } from '../services/proposalEditing';
import { ActionButton, FormField, Modal } from './ui';
import { CatalogField } from './ProposalForm';
import { SearchableSelect } from './SearchableSelect';

export function AssociationProposal({ record, editable }: { record: Program | Action; editable: boolean }) {
  const { state, reference, update } = useApp();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<OfficialFields>({});
  const [reason, setReason] = useState('');
  const [programId, setProgramId] = useState('programaId' in record ? record.programaId : '');
  const kind = 'programaId' in record ? 'action' : 'program';
  const requests = (state.planning?.associationRequests || []).filter((request) => request.entityId === record.id);
  const links = linkedRecords(state, kind, record.id, reference);
  return <div className="association-proposal">
    <ActionButton sm color="ghost" disabled={!editable} onClick={() => { setFields(Object.fromEntries(unitNames(kind).map((name) => [name, record.officialFields?.[name] || '']))); setOpen(true); }}>Propor mudança de {kind === 'action' ? 'programa ou UO' : 'UO responsável'}</ActionButton>
    {requests.length > 0 && <span className="small muted">{requests.length} proposta(s) de vínculo na revisão</span>}
    {open && <Modal wide title="Proposta de mudança de vínculo" onClose={() => setOpen(false)}>
      <p>A responsabilidade atual e os vínculos permanecem preservados. A solicitação fica separada na revisão; não transfere OBZ, localizadores nem componentes do MaPR.</p>
      {kind === 'action' && <SearchableSelect label="Programa pretendido" value={programId} disabled={!editable} options={state.programs.map((program) => ({ value: program.id, label: `${program.codigo || 'Sem código oficial'} — ${program.nome || 'Rascunho'}` }))} onChange={setProgramId} clearable={false} />}
      <CatalogField label="UO pretendida" names={unitNames(kind)} fields={fields} disabled={!editable} onChange={(values) => setFields(values)} />
      <FormField label="Motivo da mudança de vínculo" textarea value={reason} onChange={setReason} />
      <details><summary>Vínculos conferidos ({links.length})</summary>{links.length ? <ul>{links.map((link) => <li key={link}>{link}</li>)}</ul> : <p>Nenhum registro associado encontrado.</p>}</details>
      <ActionButton disabled={!reason.trim() || !fields[unitNames(kind)[0]] || kind === 'action' && !programId} onClick={() => { update((draft) => proposeAssociation(draft, reference, kind, record.id, fields, reason, kind === 'action' ? programId : undefined)); setOpen(false); }}>Registrar proposta de vínculo</ActionButton>
    </Modal>}
  </div>;
}
