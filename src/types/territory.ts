export interface Municipality {
  code: string; name: string; path: string; bounds: [number, number, number, number]; arcs: number[];
  immediate: { code: string; name: string }; intermediate: { code: string; name: string };
}
export interface TerritoryDataset {
  schemaVersion: 1; width: number; height: number; municipalities: Municipality[]; arcs: string[];
  source: { institution: string; fetchedAt: string; meshUrl: string; localitiesUrl: string; meshSha256: string; localitiesSha256: string; quality: string };
}
export interface Regionalization {
  id: string; name: string; department: string; ownerUnit: string; referenceYear: string;
  source: string; createdAt: string; regions: { id: string; name: string }[];
  memberships: Record<string, string>;
}
export interface TerritorialSeries {
  id: string; name: string; period: string; unit: string; source: string; ownerUnit: string; createdAt: string;
  indicatorRef: { kind: 'project'; mapId: string; indicatorId: string } | { kind: 'ppo'; indicatorId: string } | null;
  aggregation: 'none' | 'sum' | 'mean'; values: Record<string, number | null>;
}
export interface TerritoryState { schemaVersion: 1; regionalizations: Regionalization[]; series: TerritorialSeries[] }
