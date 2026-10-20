import { useMemo, type ReactNode } from 'react';
import type { OfficialFields, Program, Action } from '../types';
import { formatUnitCode } from '../services/budgetUnits';
import { useApp } from '../store/AppStore';
import { catalogOptions } from '../services/proposalDomain';
import { changedFields, normalizedFlag } from '../services/planningDomain';
import { SearchableSelect } from './SearchableSelect';
import { HelpTip } from './HelpTip';

export function SheetIndex({ items }: { items: { id: string; label: string }[] }) {
  return <nav className="sheet-index" aria-label="Seções da ficha">{items.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}</nav>;
}
export function SheetSection({ id, title, help, children }: { id: string; title: string; help?: string; children: ReactNode }) {
  return <section className="sheet-section" id={id} aria-labelledby={`${id}-title`}><div className="sheet-section-heading"><h2 id={`${id}-title`}>{title}</h2>{help && <HelpTip label={`Ajuda: ${title}`} text={help} />}</div>{children}</section>;
}
export function ProposalOrigin({ record, baseline }: { record: Program | Action; baseline?: Program | Action }) {
  const changed = baseline && (changedFields(baseline.officialFields || {}, record.officialFields || {}).length > 0 || ('programaId' in record ? JSON.stringify([record.local, record.detalhamentoImplementacao]) !== JSON.stringify([(baseline as Action).local, (baseline as Action).detalhamentoImplementacao]) : JSON.stringify([record.strategicLinks, record.ppoComplements]) !== JSON.stringify([(baseline as Program).strategicLinks, (baseline as Program).ppoComplements])));
  const label = record.source?.origin === 'local' ? 'Rascunho' : changed ? 'Alterado' : 'PPO';
  const description = record.source?.origin === 'local' ? 'Novo cadastro em rascunho local, sem referência oficial anterior.' : changed ? 'Proposta de alteração. A referência importada do PPO está preservada.' : 'Cadastro importado do PPO.';
  return <span className="proposal-origin"><HelpTip label="Origem da proposta" text={`${description} Identificador interno: ${record.id}`}><span className={`badge ${record.source?.origin === 'local' ? 'purple' : changed ? 'orange' : 'blue'}`}>{label}</span></HelpTip></span>;
}
export function PendingFields({ fields }: { fields: string[] }) {
  return fields.length ? <HelpTip label="Campos pendentes" text={<><b>Preenchimento pendente</b><ul>{fields.map((field) => <li key={field}>{field}</li>)}</ul>O rascunho incompleto pode ser salvo.</>}><span className="pending-count">{fields.length} pendências</span></HelpTip> : null;
}
export function CatalogField({ label, names, fields, onChange, disabled, localValue = false, catalogRows, hint }: { label: string; names: string[]; fields: OfficialFields; onChange: (values: OfficialFields) => void; disabled: boolean; localValue?: boolean; catalogRows?: OfficialFields[]; hint?: string }) {
  const { reference } = useApp();
  const options = useMemo(() => catalogOptions(catalogRows || [...reference.programs.flatMap((program) => [program.officialFields || {}, ...(program.strategicLinks || [])]), ...reference.actions.map((action) => action.officialFields || {}), ...reference.indicators.map((indicator) => indicator.fields)], names), [reference, catalogRows, names.join('|')]);
  const current = Object.fromEntries(names.map((name) => [name, fields[name] || '']));
  const value = names.some((name) => current[name]) ? JSON.stringify(current) : '';
  const all = value && !options.some((option) => JSON.stringify(option) === value) ? [current, ...options] : options;
  return <SearchableSelect label={label} hint={hint} disabled={disabled} value={value} options={all.map((option) => ({ value: JSON.stringify(option), label: names.map((name) => name.startsWith('Código da Unidade Orçamentária') ? formatUnitCode(option[name]) : option[name]).filter(Boolean).join(' — ') }))}
    onChange={(value) => onChange(value ? JSON.parse(value) : Object.fromEntries(names.map((name) => [name, ''])))}
    allowLocal={localValue} onLocal={(value) => onChange(Object.fromEntries(names.map((name, index) => [name, index === names.length - 1 ? value : ''])))} />;
}
export function OfficialFlag({ name, value, disabled, onChange }: { name: string; value?: string; disabled: boolean; onChange: (value: string) => void }) {
  const parsed = normalizedFlag(value);
  return <div className="field"><label>{name}</label><select aria-label={name} disabled={disabled} value={value || ''} onChange={(event) => onChange(event.target.value)}><option value="">Não informado</option>{value && !['Sim', 'Não'].includes(value) && <option value={value}>{parsed === true ? 'Sim' : parsed === false ? 'Não' : value} · original: {value}</option>}<option>Sim</option><option>Não</option></select></div>;
}
