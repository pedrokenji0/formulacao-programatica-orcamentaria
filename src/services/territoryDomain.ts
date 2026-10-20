import municipalityCatalog from '../../data/territorio/municipios.json' with { type: 'json' };
import type { AppState, Municipality, Regionalization, TerritorialSeries, TerritoryDataset, TerritoryState, PlanningDataset } from '../types/index.ts';
import { unitCode } from './budgetUnits.ts';

export const EMPTY_TERRITORY = (): TerritoryState => ({ schemaVersion: 1, regionalizations: [], series: [] });
export const NO_DATA_COLOR = '#e6e9ed';
export const MAP_PALETTE = ['#e0f2f1', '#a8d8ce', '#62b5ad', '#26867f', '#075b59'];
export const REGION_PALETTE = ['#2a7f8e', '#9274b1', '#ca8846', '#539764', '#bd6473', '#6081bc', '#9b9542', '#717b88'];
const MUNICIPALITY_CODES = new Set(municipalityCatalog.map((m) => m.code));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const normalizeTerritoryText = (value: unknown) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function canEditTerritory(state: AppState, record?: { ownerUnit: string; reference?: unknown }) {
  if (record?.reference || ['Leitor', 'Consulta', 'DCMEFO/SEPLAG'].includes(state.perfil)) return false;
  const scope = unitCode(state.unidade);
  if (!record) return /^\d+$/.test(scope);
  return state.perfil !== 'Gestor UA' || !!scope && scope === record.ownerUnit;
}
export function validateTerritoryDataset(data: TerritoryDataset) {
  if (data.schemaVersion !== 1 || data.municipalities.length !== 853 || new Set(data.municipalities.map((m) => m.code)).size !== 853) throw new Error('Malha municipal incompleta: esperados 853 códigos IBGE únicos.');
  for (const m of data.municipalities) if (!/^31\d{5}$/.test(m.code) || !m.name || !m.path || !m.arcs.length || m.arcs.some((id) => !data.arcs[id]) || m.bounds.some((v) => !Number.isFinite(v))) throw new Error('Geometria municipal inválida: ' + m.code);
  return data;
}
export function ibgeRegionalizations(data: TerritoryDataset): Regionalization[] {
  return (['intermediate', 'immediate'] as const).map((key) => {
    const regions = [...new Map(data.municipalities.map((m) => [m[key].code, { id: m[key].code, name: m[key].name }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return { id: 'ibge-' + key, name: key === 'intermediate' ? 'Regiões geográficas intermediárias' : 'Regiões geográficas imediatas', department: 'IBGE', ownerUnit: '', referenceYear: '', source: 'API de Localidades IBGE', createdAt: data.source.fetchedAt, regions, memberships: Object.fromEntries(data.municipalities.map((m) => [m.code, m[key].code])) };
  });
}
export function regionBoundaryPaths(data: TerritoryDataset, scheme?: Regionalization) {
  if (!scheme) return [];
  const owners = new Map<number, Set<string>>();
  for (const m of data.municipalities) for (const arc of m.arcs) {
    if (!owners.has(arc)) owners.set(arc, new Set());
    owners.get(arc)!.add(scheme.memberships[m.code] || '');
  }
  return [...owners].filter(([, regions]) => regions.size > 1).map(([arc]) => data.arcs[arc]);
}
export function parseTerritoryNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (typeof value === 'number') { if (Number.isFinite(value)) return value; throw new Error('Valor não finito.'); }
  const text = String(value).trim();
  const normalized = text.includes(',') && /^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(text) ? text.replace(/\./g, '').replace(',', '.') : text;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) throw new Error('Valor numérico inválido: ' + text);
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error('Valor não finito.');
  return number;
}
export function parseTerritorialRows(rows: Record<string, unknown>[], data: TerritoryDataset, kind: 'series' | 'regions') {
  const valid = new Set(data.municipalities.map((m) => m.code));
  const entries: { code: string; value: number | null; region: string }[] = [];
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    if (Object.values(row).every((v) => v === null || v === undefined || String(v).trim() === '')) continue;
    const fields = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeTerritoryText(key).replace(/[^a-z0-9]/g, ''), value]));
    const code = String(fields.codigoibge ?? fields.codigodomunicipioibge ?? fields.ibge ?? '').trim();
    if (!valid.has(code)) throw new Error('Linha ' + (index + 2) + ': código IBGE de Minas Gerais não reconhecido: ' + (code || 'vazio'));
    if (seen.has(code)) throw new Error('Município repetido na planilha: ' + code);
    seen.add(code);
    const region = String(fields.regiao ?? '').trim();
    if (kind === 'regions' && !region) throw new Error('Linha ' + (index + 2) + ': informe a região.');
    if (kind === 'series' && !('valor' in fields)) throw new Error('Coluna valor não encontrada. Use codigo_ibge e valor.');
    entries.push({ code, value: kind === 'series' ? parseTerritoryNumber(fields.valor) : null, region });
  }
  if (!entries.length) throw new Error('A planilha não contém municípios.');
  return entries;
}
export function createRegionalization(state: AppState, data: TerritoryDataset, input: { name: string; department: string; referenceYear: string; source: string; rows?: Record<string, unknown>[] }): Regionalization {
  if (!canEditTerritory(state)) throw new Error('Sem permissão para cadastrar regionalização nesta UO.');
  if (!input.name.trim() || !input.department.trim() || !/^\d{4}$/.test(input.referenceYear)) throw new Error('Informe nome, secretaria e ano de referência.');
  const entries = input.rows ? parseTerritorialRows(input.rows, data, 'regions') : [];
  const names = [...new Set(entries.map((entry) => entry.region))];
  const regions = names.map((name, index) => ({ id: 'regiao-' + (index + 1), name }));
  return { id: 'regionalizacao-local-' + crypto.randomUUID(), name: input.name.trim(), department: input.department.trim(), ownerUnit: unitCode(state.unidade), referenceYear: input.referenceYear, source: input.source.trim(), createdAt: new Date().toISOString(), regions, memberships: Object.fromEntries(entries.map((entry) => [entry.code, regions[names.indexOf(entry.region)].id])) };
}
export function createTerritorialSeries(state: AppState, data: TerritoryDataset, input: Omit<TerritorialSeries, 'id' | 'ownerUnit' | 'createdAt' | 'values'> & { rows: Record<string, unknown>[] }): TerritorialSeries {
  if (!canEditTerritory(state)) throw new Error('Sem permissão para cadastrar valores nesta UO.');
  if (!input.name.trim() || !input.period.trim() || !input.unit.trim() || !input.source.trim()) throw new Error('Informe indicador, período, unidade e fonte.');
  const entries = parseTerritorialRows(input.rows, data, 'series');
  return { id: 'serie-territorial-' + crypto.randomUUID(), name: input.name.trim(), period: input.period.trim(), unit: input.unit.trim(), source: input.source.trim(), aggregation: input.aggregation, indicatorRef: input.indicatorRef, ownerUnit: unitCode(state.unidade), createdAt: new Date().toISOString(), values: Object.fromEntries(entries.map((entry) => [entry.code, entry.value])) };
}
export function colorScale(values: (number | null | undefined)[], method: 'equal' | 'quantile' = 'equal', reversed = false) {
  const numbers = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  const palette = reversed ? [...MAP_PALETTE].reverse() : MAP_PALETTE;
  if (!numbers.length) return { bins: [] as { upper: number; lower: number; color: string }[], color: (_value: number | null | undefined) => NO_DATA_COLOR };
  const min = numbers[0], max = numbers[numbers.length - 1];
  const cuts = min === max ? [max] : [...new Set(Array.from({ length: 5 }, (_, i) => method === 'equal' ? min + (max - min) * (i + 1) / 5 : numbers[Math.min(numbers.length - 1, Math.ceil(numbers.length * (i + 1) / 5) - 1)]))];
  const bins = cuts.map((upper, i) => ({ lower: i ? cuts[i - 1] : min, upper, color: palette[cuts.length === 1 ? 2 : Math.round(i * 4 / (cuts.length - 1))] }));
  return { bins, color: (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? NO_DATA_COLOR : (bins.find((bin) => value <= bin.upper) || bins[bins.length - 1]).color };
}
export function regionalValues(data: TerritoryDataset, series: TerritorialSeries, scheme: Regionalization) {
  return Object.fromEntries(scheme.regions.map((region) => {
    const municipalities = data.municipalities.filter((m) => scheme.memberships[m.code] === region.id);
    const values = municipalities.map((m) => series.values[m.code]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const sum = values.reduce((total, value) => total + value, 0);
    return [region.id, { value: !values.length || series.aggregation === 'none' ? null : series.aggregation === 'sum' ? sum : sum / values.length, observed: values.length, total: municipalities.length }];
  }));
}
export function assignMunicipalities(scheme: Regionalization, codes: string[], regionId: string, data: TerritoryDataset) {
  if (regionId && !scheme.regions.some((region) => region.id === regionId)) throw new Error('Região não encontrada.');
  if (codes.some((code) => !data.municipalities.some((m) => m.code === code))) throw new Error('Município não encontrado.');
  for (const code of codes) if (regionId) scheme.memberships[code] = regionId; else delete scheme.memberships[code];
}
export function enforceTerritoryUpdate(previous: AppState, next: AppState, reference?: PlanningDataset) {
  if (same(previous.territory, next.territory)) return;
  const before = previous.territory || EMPTY_TERRITORY(), after = next.territory || EMPTY_TERRITORY();
  if (after.schemaVersion !== 1) throw new Error('Versão territorial inválida.');
  for (const key of ['regionalizations', 'series'] as const) {
    const records: (Regionalization | TerritorialSeries)[] = after[key];
    if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error('Identificador territorial duplicado.');
    for (const record of records) {
      const old = (before[key] as (Regionalization | TerritorialSeries)[]).find((item) => item.id === record.id);
      if (same(old, record)) continue;
      if (record.reference) throw new Error('As referências territoriais importadas são protegidas. Cadastre uma proposta local.');
      if (!canEditTerritory(previous, old || undefined) || !/^\d+$/.test(record.ownerUnit) || !old && record.ownerUnit !== unitCode(previous.unidade)) throw new Error('Sem permissão para alterar os dados territoriais desta UO.');
      if (old && (!same(old.ownerUnit, record.ownerUnit) || !same(old.createdAt, record.createdAt))) throw new Error('Origem e UO responsável protegidas.');
      if (!record.name.trim()) throw new Error('Informe o nome do cadastro territorial.');
      if ('memberships' in record) {
        if (!record.id.startsWith('regionalizacao-local-') || !record.department.trim()) throw new Error('Regionalização local inválida.');
        const ids = new Set(record.regions.map((region) => region.id));
        if (ids.size !== record.regions.length || record.regions.some((region) => !region.name.trim())) throw new Error('Regiões repetidas ou sem nome.');
        for (const [code, region] of Object.entries(record.memberships)) if (!MUNICIPALITY_CODES.has(code) || !ids.has(region)) throw new Error('Vínculo municipal inválido.');
      } else {
        if (!record.id.startsWith('serie-territorial-') || !record.period.trim() || !record.unit.trim() || !record.source.trim() || !['none', 'sum', 'mean'].includes(record.aggregation)) throw new Error('Série territorial inválida.');
        for (const [code, value] of Object.entries(record.values)) if (!MUNICIPALITY_CODES.has(code) || value !== null && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Valor municipal inválido.');
        const ref = record.indicatorRef;
        if (ref && (ref.kind === 'project' ? !next.projectMaps?.some((map) => map.id === ref.mapId && map.indicators.some((item) => item.id === ref.indicatorId)) : !next.planning?.localIndicators.some((item) => item.id === ref.indicatorId) && !next.planning?.indicatorProposals[ref.indicatorId] && !reference?.indicators.some((indicator) => indicator.id === ref.indicatorId))) throw new Error('Indicador associado não encontrado.');
      }
    }
    for (const record of before[key]) if (!after[key].some((item) => item.id === record.id)) throw new Error('Os dados territoriais devem ser preservados.');
  }
}
