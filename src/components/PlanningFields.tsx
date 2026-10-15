import { useState } from 'react';
import { FormField } from './ui';
import type { OfficialFields } from '../types';
import { changedFields, situation } from '../services/planningDomain';

export function PlanningFields({ fields, names, onChange, disabled, hints = {}, locked = [] }: {
  fields: OfficialFields; names: string[]; onChange: (field: string, value: string) => void; disabled: boolean;
  hints?: Record<string, string>; locked?: string[];
}) {
  return <div className="planning-fields">{names.map((field) => <FormField key={field} label={field} value={fields[field] ?? ''}
    textarea={!/^(Código|Exclusão|Programa Novo|Nova Ação|Indicador Novo|Programa Transposto|Ação Transposta|Transferida|Índice|Data |Em apuração|Polaridade|Unidade de Medida|Periodicidade|Base Geográfica|Tipo de Programa|Horizonte Temporal)/.test(field)}
    disabled={disabled || locked.includes(field)} hint={hints[field]} onChange={(value) => onChange(field, value)} />)}</div>;
}
export function SituationBadge({ value, label = '' }: { value?: string; label?: string }) {
  const status = situation(value);
  return <span className={`badge ${status === 'Excluído' ? 'red' : status === 'Ativo' ? 'green' : 'gray'}`}>{label}{status}</span>;
}
export function ImportedReference({ fields, proposal }: { fields?: OfficialFields; proposal?: OfficialFields }) {
  const [open, setOpen] = useState(false);
  if (!fields) return <p className="small muted">Cadastro complementar local, sem registro oficial correspondente.</p>;
  const changes = proposal ? changedFields(fields, proposal).length : 0;
  return <details className="reference-panel" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Referência importada do PPO {changes > 0 && <span className="badge orange">{changes} campos alterados</span>}</summary>
    {open && <dl className="reference-grid">{Object.entries(fields).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Campo vazio na base'}</dd></div>)}</dl>}
  </details>;
}
