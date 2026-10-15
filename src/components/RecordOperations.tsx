import { useState } from 'react';
import type { PlanningEntityKind } from '../types';
import type { EditableRecord } from '../services/editingPolicy';
import { exclusionName, exclusionRequirement, linkedRecords, localRecord, recordFields } from '../services/editingPolicy';
import { normalizedFlag } from '../services/planningDomain';
import { changeSituation, discardDraft } from '../services/proposalEditing';
import { useApp } from '../store/AppStore';
import { ActionButton, FormField, Modal } from './ui';

export function RecordOperations({ kind, record, editable, onExclude, statusValue }: { kind: PlanningEntityKind; record: EditableRecord; editable: boolean; onExclude?: () => void; statusValue?: string }) {
  const { state, reference, update } = useApp();
  const [operation, setOperation] = useState('');
  const [reason, setReason] = useState('');
  const local = localRecord(record);
  const excluded = normalizedFlag(statusValue ?? recordFields(record)[exclusionName(kind)]) === true;
  const requirement = exclusionRequirement(kind, record);
  const links = local && (kind === 'program' || kind === 'action') ? linkedRecords(state, kind, record.id, reference) : [];
  return <>
    <ActionButton color="ghost" disabled={!editable} onClick={() => { if (!local && !excluded && onExclude) onExclude(); else setOperation(local ? 'descarte' : excluded ? 'restauracao' : 'exclusao'); }}>{local ? 'Descartar rascunho' : excluded ? 'Restaurar na proposta' : 'Propor exclusão'}</ActionButton>
    {operation && <Modal title={operation === 'descarte' ? 'Descartar rascunho?' : operation === 'restauracao' ? 'Restaurar na proposta?' : 'Propor exclusão'} onClose={() => setOperation('')}>
      {operation === 'descarte' && <p>O conteúdo será mantido no histórico de descarte.</p>}
      {links.length > 0 && <div className="alert warn">Resolva os vínculos antes de descartar:<ul>{links.map((link) => <li key={link}>{link}</li>)}</ul></div>}
      {operation === 'exclusao' && requirement.unknown && <p className="alert warn">Condição cadastral de novidade não informada. Pendência de conferência; o mockup solicita justificativa.</p>}
      {operation === 'exclusao' && requirement.required && <FormField label="Justificativa de exclusão" textarea value={reason} onChange={setReason} />}
      <ActionButton color={operation === 'restauracao' ? 'blue' : 'red'} disabled={!!links.length || operation === 'exclusao' && requirement.required && !reason.trim()} onClick={() => {
        update((draft) => { if (operation === 'descarte') discardDraft(draft, reference, kind, record.id); else changeSituation(draft, reference, kind, record.id, operation === 'exclusao', reason); });
        setOperation('');
      }}>{operation === 'descarte' ? 'Confirmar descarte' : operation === 'restauracao' ? 'Confirmar restauração' : 'Confirmar proposta de exclusão'}</ActionButton>
    </Modal>}
  </>;
}
