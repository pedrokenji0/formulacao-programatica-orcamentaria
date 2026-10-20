export interface Municipality {
  code: string; name: string; path: string; bounds: [number, number, number, number]; arcs: number[];
  immediate: { code: string; name: string }; intermediate: { code: string; name: string };
}
export interface TerritoryDataset {
  schemaVersion: 1; width: number; height: number; municipalities: Municipality[]; arcs: string[];
  source: { institution: string; fetchedAt: string; meshUrl: string; localitiesUrl: string; meshSha256: string; localitiesSha256: string; quality: string };
}
export interface Regionalization {
  reference?: { kind: 'fjp'; edition: string; sourceUrl: string; sourceHash: string; sheet: string; column: string };

  id: string; name: string; department: string; ownerUnit: string; referenceYear: string;
  source: string; createdAt: string; regions: { id: string; name: string }[];
  memberships: Record<string, string>;
}
export interface PhysicalTargetReference {
  kind: 'physical-target'; actionId: string; actionCode: string; programId: string; projectCode: string;
  productCode: string; product: string; unitCode: string; field: string; sourcePath: string; sourceBlobSha: string;
  observations: { localizerCode: string; scope: 'municipality' | 'intermediate' | 'state'; territoryCode: string; territoryName: string; value: number | null; sourceRow: number }[];
  sourceTotal: number | null; actionTotal: number | null;
}
export interface BudgetForecastReference extends Omit<PhysicalTargetReference, 'kind'> {
  kind: 'budget-forecast';
}
export interface TerritorialSeries {
  reference?: PhysicalTargetReference | BudgetForecastReference;
  id: string; name: string; period: string; unit: string; source: string; ownerUnit: string; createdAt: string;
  indicatorRef: { kind: 'project'; mapId: string; indicatorId: string } | { kind: 'ppo'; indicatorId: string } | null;
  aggregation: 'none' | 'sum' | 'mean'; values: Record<string, number | null>;
}
export interface TerritoryState { schemaVersion: 1; regionalizations: Regionalization[]; series: TerritorialSeries[] }
