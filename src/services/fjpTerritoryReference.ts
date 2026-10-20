import fjpReference from '../../data/territorio/regionalizacoes-fjp.json' with { type: 'json' };
import { ibgeRegionalizations } from './territoryDomain.ts';
import type { Regionalization, TerritoryDataset } from '../types/index.ts';

export const fjpRegionalizations = fjpReference.regionalizations as Regionalization[];
export const fjpRegionalizationSource = fjpReference.source;
export function referenceRegionalizations(data: TerritoryDataset): Regionalization[] {
  const ibge = ibgeRegionalizations(data);
  const merged = new Set<string>();
  const base = ibge.map((scheme) => {
    const counterpart = fjpRegionalizations.find((candidate) => candidate.id === scheme.id.replace('ibge-', 'fjp-'));
    if (!counterpart || !data.municipalities.every((m) => scheme.memberships[m.code] === counterpart.memberships[m.code])) return scheme;
    merged.add(counterpart.id);
    return { ...counterpart, id: scheme.id };
  });
  return [...base, ...fjpRegionalizations.filter((scheme) => !merged.has(scheme.id))];
}
