import targetReference from '../../data/territorio/metas-fisicas-reurb.json' with { type: 'json' };
import budgetReference from '../../data/territorio/recursos-reurb.json' with { type: 'json' };
import type { Regionalization, TerritorialSeries, TerritoryDataset } from '../types/index.ts';

export const planningTargetSeries = targetReference.series as TerritorialSeries[];
export const planningBudgetSeries = budgetReference.series as TerritorialSeries[];
const sumKnown = (values: (number | null)[]) => { const known = values.filter((value): value is number => value !== null); return known.length ? known.reduce((sum, value) => sum + value, 0) : null; };
export function planningReferenceTotals(series: TerritorialSeries) {
  if (!series.reference) return null;
  const observations = series.reference.observations;
  return {
    total: series.reference.sourceTotal, actionTotal: series.reference.actionTotal,
    municipality: sumKnown(observations.filter((row) => row.scope === 'municipality').map((row) => row.value)),
    intermediate: sumKnown(observations.filter((row) => row.scope === 'intermediate').map((row) => row.value)),
    state: sumKnown(observations.filter((row) => row.scope === 'state').map((row) => row.value)),
    reconciled: series.reference.sourceTotal === series.reference.actionTotal,
  };
}
export function isIntermediateScheme(data: TerritoryDataset, scheme?: Regionalization) {
  if (!scheme) return false;
  const groupToOriginal = new Map<string, string>(), originalToGroup = new Map<string, string>();
  for (const m of data.municipalities) {
    const own = scheme.memberships[m.code], original = m.intermediate.code;
    if (!own || groupToOriginal.has(own) && groupToOriginal.get(own) !== original || originalToGroup.has(original) && originalToGroup.get(original) !== own) return false;
    groupToOriginal.set(own, original); originalToGroup.set(original, own);
  }
  return true;
}
export function planningRegionalValues(data: TerritoryDataset, series: TerritorialSeries, scheme: Regionalization) {
  const compatible = isIntermediateScheme(data, scheme);
  return Object.fromEntries(scheme.regions.map((region) => {
    const municipalities = data.municipalities.filter((m) => scheme.memberships[m.code] === region.id);
    const values = municipalities.map((m) => series.values[m.code]).filter((value): value is number => typeof value === 'number');
    const direct = compatible && municipalities.length ? series.reference?.observations.filter((row) => row.scope === 'intermediate' && row.territoryCode === municipalities[0].intermediate.code).map((row) => row.value) || [] : [];
    const directValue = sumKnown(direct), municipalValue = sumKnown(values);
    return [region.id, { value: sumKnown([directValue, municipalValue]), observed: values.length, total: municipalities.length, declaredRegional: directValue !== null, compatible }];
  }));
}

export function budgetComparison(period: string, records = planningBudgetSeries) {
  const series = records.filter((record) => record.reference?.kind === 'budget-forecast' && record.period === period);
  const totals = series.map((record) => record.reference!.sourceTotal);
  const total = sumKnown(totals);
  const complete = series.length === 2 && totals.every((value) => value !== null);
  return {
    total, complete,
    actions: series.map((record) => ({
      series: record, total: record.reference!.sourceTotal,
      share: complete && total !== null && total > 0 && record.reference!.sourceTotal !== null ? record.reference!.sourceTotal / total * 100 : null,
    })),
  };
}
export const formatBudget = (value: number | null | undefined) => value === null || value === undefined ? 'Sem dados' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
