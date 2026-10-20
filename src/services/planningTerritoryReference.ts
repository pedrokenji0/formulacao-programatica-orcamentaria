import targetReference from '../../data/territorio/metas-fisicas-reurb.json' with { type: 'json' };
import type { Regionalization, TerritorialSeries, TerritoryDataset } from '../types/index.ts';

export const planningTargetSeries = targetReference.series as TerritorialSeries[];
const sumKnown = (values: (number | null)[]) => { const known = values.filter((value): value is number => value !== null); return known.length ? known.reduce((sum, value) => sum + value, 0) : null; };
export function physicalTargetTotals(series: TerritorialSeries) {
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
export function physicalRegionalValues(data: TerritoryDataset, series: TerritorialSeries, scheme: Regionalization) {
  const compatible = isIntermediateScheme(data, scheme);
  return Object.fromEntries(scheme.regions.map((region) => {
    const municipalities = data.municipalities.filter((m) => scheme.memberships[m.code] === region.id);
    const values = municipalities.map((m) => series.values[m.code]).filter((value): value is number => typeof value === 'number');
    const direct = compatible && municipalities.length ? series.reference?.observations.filter((row) => row.scope === 'intermediate' && row.territoryCode === municipalities[0].intermediate.code).map((row) => row.value) || [] : [];
    const directValue = sumKnown(direct), municipalValue = sumKnown(values);
    return [region.id, { value: sumKnown([directValue, municipalValue]), observed: values.length, total: municipalities.length, declaredRegional: directValue !== null, compatible }];
  }));
}
