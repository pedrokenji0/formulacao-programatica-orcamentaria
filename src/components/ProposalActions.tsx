import { useState } from 'react';
import type { Program, Action } from '../types';
import { useApp } from '../store/AppStore';
import { ActionButton, FormField, Modal, useToast } from './ui';
import { Save, RotateCcw } from 'lucide-react';
import { RecordOperations } from './RecordOperations';
import { exclusionRequirement } from '../services/editingPolicy';
import { HelpTip } from './HelpTip';
import type { ReactNode } from 'react';

export function ProposalActions({ position, editable, onRestore, onExclude, metadata, record }: { position: 'início' | 'final'; editable: boolean; onRestore?: () => void; onExclude?: () => void; metadata?: ReactNode; record?: Program | Action }) {
  const { state, saveNow } = useApp();
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  return <div className="proposal-actions" role="toolbar" aria-label={`Ações da proposta — ${position}`}>
    <ActionButton icon={<Save size={15} />} disabled={!editable || saving} onClick={async () => { setSaving(true); try { await saveNow(); toast('Proposta salva neste navegador.', 'ok'); } catch { toast('Não foi possível salvar. Exporte a proposta para preservar o trabalho.', 'err'); } finally { setSaving(false); } }}>{saving ? 'Salvando…' : 'Salvar proposta'}</ActionButton>
    {onRestore && <ActionButton color="ghost" icon={<RotateCcw size={15} />} disabled={!editable} onClick={onRestore}>Reverter para o original</ActionButton>}
    {record && <RecordOperations kind={'programaId' in record ? 'action' : 'program'} record={record} editable={editable} onExclude={onExclude} />}
    {metadata && <span className="record-meta">{metadata}{record && state.planning?.review?.[record.id] && <HelpTip label="Situação da revisão local" text="Revisão nesta ferramenta, separada da situação oficial do PPO."><span className="badge gray">{state.planning.review[record.id].status === 'revisado' ? 'Revisado localmente' : 'Revisão pendente'}</span></HelpTip>}</span>}
  </div>;
}
export function RestoreProposal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return <Modal title="Reverter para o original?" onClose={onClose} foot={<><ActionButton color="ghost" onClick={onClose}>Cancelar</ActionButton><ActionButton onClick={onConfirm}>Confirmar reversão</ActionButton></>}>
    <p>Os campos desta ficha e seus complementos locais voltam à referência importada do PPO.</p><p>Outros cadastros vinculados, indicadores, localizadores e o conteúdo do MaPR são preservados. Esta operação não altera a base importada.</p>
  </Modal>;
}
export function ExclusionProposal({ record, editable, onChange, onConfirm }: { record: Program | Action; editable: boolean; onChange: (value: string) => void; onConfirm: () => void }) {
  const program = !('programaId' in record);
  const label = program ? 'Justificativa de Inclusão ou Exclusão do Programa' : 'Justificativa de Inclusão ou Exclusão da Ação';
  const reason = record.officialFields?.[label] || '';
  const requirement = exclusionRequirement(program ? 'program' : 'action', record);
  return <section className="sheet-section"><h2>Justificativa de exclusão</h2><p className="small muted">A exclusão é uma proposta local e lógica. O cadastro permanece disponível para consulta e comparação; não é apagado nem enviado ao PPO.</p>
    {program && <p className="small muted">As ações e os localizadores vinculados não serão excluídos automaticamente. Suas situações são independentes.</p>}
    {requirement.unknown && <p className="alert warn">Condição cadastral de novidade ausente: pendência de conferência. Por decisão do mockup, informe justificativa.</p>}
    {requirement.required && <FormField label={label} textarea value={reason} disabled={!editable} onChange={onChange} hint="Exigência para registro não novo — expressa no manual." />}
    <ActionButton color="red" disabled={!editable || requirement.required && !reason.trim()} onClick={onConfirm}>Confirmar proposta de exclusão</ActionButton>
  </section>;
}
