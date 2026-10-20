import type { PlanningDataset } from '../types/index.ts';

// These four entries are intentionally hidden from the working UO selector.
// Source records remain intact for provenance and imported associations.
const HIDDEN_UNITS = new Set(['4741', '4441', '4451', '1991']);
export const unitCode = (value: string | undefined) => String(value || '').trim().split(/\s*[-—]\s*/)[0].replace(/^0+(?=\d)/, '');
export const formatUnitCode = (value: string | undefined) => String(value || '').trim().replace(/^0+(?=\d)/, '');
export const formatUnitLabel = (value: string | undefined) => String(value || '').trim().replace(/^0+(?=\d)/, '').replace(/^(\d+)\s*[-—]\s*/, '$1 — ');

export function budgetUnitOptions(reference: Pick<PlanningDataset, 'programs' | 'actions'>) {
  const units = new Map<string, string>();
  for (const record of [...reference.programs, ...reference.actions]) {
    const code = formatUnitCode(record.codigoUnidadeOrcamentaria || unitCode(record.unidadeOrcamentaria));
    if (!/^\d+$/.test(code) || HIDDEN_UNITS.has(code)) continue;
    const name = String(record.unidadeOrcamentaria || '').replace(/^\s*\d+\s*[-—]\s*/, '').trim();
    if (name) units.set(code, `${code} — ${name}`);
  }
  return [...units.entries()].sort(([a], [b]) => Number(a) - Number(b)).map(([, label]) => label);
}
