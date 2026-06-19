import { FormField, SelectField } from './ui';

export interface MirrorFieldDef {
  key: string;
  label: string;
  textarea?: boolean;
  options?: string[];
  type?: string;
  disabled?: boolean;
  full?: boolean;
}

export function MirrorForm<T extends Record<string, any>>({ defs, value, onChange }: {
  defs: MirrorFieldDef[]; value: T; onChange: (key: string, v: string) => void;
}) {
  return (
    <div className="grid g2">
      {defs.map((d) => (
        <div key={d.key} style={d.full ? { gridColumn: '1 / -1' } : undefined}>
          {d.options
            ? <SelectField label={d.label} value={String(value[d.key] ?? '')} options={d.options} onChange={(v) => onChange(d.key, v)} />
            : <FormField label={d.label} type={d.type} textarea={d.textarea} disabled={d.disabled}
                value={String(value[d.key] ?? '')} onChange={(v) => onChange(d.key, v)} />}
        </div>
      ))}
    </div>
  );
}
