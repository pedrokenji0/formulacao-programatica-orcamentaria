import catalogData from '../../data/territorio/planejamento-projetos.json' with { type: 'json' };
import type { PlanningTerritoryCatalog, Regionalization, TerritorialSeries, TerritoryDataset } from '../types/index.ts';

export const planningTerritoryCatalog = catalogData as PlanningTerritoryCatalog;
export const planningProjects = planningTerritoryCatalog.projects;
export const planningCycle = planningTerritoryCatalog.cycle;
export function planningYears(revisionYear: string) {
  if (!/^\d{4}$/.test(revisionYear)) throw new Error('Ano de revisão inválido.');
  return Array.from({ length: 4 }, (_, index) => String(Number(revisionYear) + index));
}
export function catalogSeries(catalog: PlanningTerritoryCatalog, kind: 'physical-target' | 'budget-forecast'): TerritorialSeries[] {
  const budget = kind === 'budget-forecast', metric = budget ? 'budget' : 'physical';
  return catalog.projects.flatMap((project) => project.actions.flatMap((action) => planningYears(catalog.cycle.revisionYear).map((year): TerritorialSeries => {
    const observations = action.localizers.map((row) => ({ localizerCode: row.code, scope: row.scope, territoryCode: row.territoryCode, territoryName: row.territoryName, value: row.forecasts[year]?.[metric] ?? null, sourceRow: row.sourceRow }));
    const values: Record<string, number | null> = {};
    for (const row of observations.filter((row) => row.scope === 'municipality')) {
      if (!(row.territoryCode in values)) values[row.territoryCode] = null;
      if (row.value !== null) values[row.territoryCode] = (values[row.territoryCode] ?? 0) + row.value;
    }
    const field = (budget ? 'Previsão Orçamentária ' : 'Previsão Física ') + year;
    return { id: (budget ? 'ppo-orcamento-' : 'ppo-meta-fisica-') + action.programCode + '-' + action.ownerUnit + '-' + action.code + '-' + year, name: (budget ? 'Previsão orçamentária — ação ' : 'Meta física prevista — ação ') + action.code + ' (' + action.name + ')', period: year, unit: budget ? 'R$' : action.unit, source: 'PPO · localizadores · ' + field, ownerUnit: action.ownerUnit, createdAt: '', indicatorRef: null, aggregation: 'sum',
      values, reference: { kind, actionId: action.id, actionCode: action.code, programId: 'ppo-programa-' + action.programCode, projectCode: project.code, productCode: action.productCode, product: action.product, unitCode: budget ? 'BRL' : action.unitCode, field, sourcePath: catalog.source.localizers.path, sourceBlobSha: catalog.source.localizers.blobSha, observations, sourceTotal: sumKnown(observations.map((row) => row.value)), actionTotal: action.totals[year]?.[metric] ?? null } };
  })));
}
const sumKnown = (values: (number | null)[]) => { const known = values.filter((value): value is number => value !== null); return known.length ? known.reduce((sum, value) => sum + value, 0) : null; };
export function planningReferenceTotals(series: TerritorialSeries) {
  if (!series.reference) return null;
  const observations = series.reference.observations;
  return {
    total: series.reference.sourceTotal, actionTotal: series.reference.actionTotal,
    municipality: sumKnown(observations.filter((row) => row.scope === 'municipality').map((row) => row.value)),
    intermediate: sumKnown(observations.filter((row) => row.scope === 'intermediate').map((row) => row.value)),
    state: sumKnown(observations.filter((row) => row.scope === 'state').map((row) => row.value)),
    reconciled: series.reference.sourceTotal !== null && series.reference.actionTotal !== null && Math.abs(series.reference.sourceTotal - series.reference.actionTotal) < 0.000001,
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


export const planningTargetSeries = catalogSeries(planningTerritoryCatalog, 'physical-target');
export const planningBudgetSeries = catalogSeries(planningTerritoryCatalog, 'budget-forecast');
export function budgetComparison(period: string, records = planningBudgetSeries, projectCode = '14') {
  const series = records.filter((record) => record.reference?.kind === 'budget-forecast' && record.reference.projectCode === projectCode && record.period === period);
  const totals = series.map((record) => record.reference!.sourceTotal);
  const total = sumKnown(totals);
  const complete = series.length > 0 && totals.every((value) => value !== null);
  return { total, complete, actions: series.map((record) => ({ series: record, total: record.reference!.sourceTotal, share: complete && total !== null && total > 0 && record.reference!.sourceTotal !== null ? record.reference!.sourceTotal / total * 100 : null })) };
}
export const formatBudget = (value: number | null | undefined) => value === null || value === undefined ? 'Sem dados' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
