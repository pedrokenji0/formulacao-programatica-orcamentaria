import { useEffect, useMemo, useState } from 'react';
import { Download, MapPinned, Upload } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { ActionButton, Card, FormField } from '../../components/ui';
import { TerritoryMap } from '../../components/TerritoryMap';
import { canEditTerritory, colorScale, ibgeRegionalizations, NO_DATA_COLOR, normalizeTerritoryText, parseTerritoryNumber, regionalValues, REGION_PALETTE, validateTerritoryDataset } from '../../services/territoryDomain';
import { RegionalizationEditor } from './RegionalizationEditor';
import { TerritoryImport, downloadTerritoryText } from './TerritoryImport';
import type { TerritoryDataset } from '../../types';

const number = (value: number | null | undefined) => value === null || value === undefined ? 'Sem dados' : value.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const csvCell = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';

export function TerritoryPage() {
  const [data, setData] = useState<TerritoryDataset | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    fetch(import.meta.env.BASE_URL + 'data/mg-municipios.json', { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error('Malha municipal indisponível.'); return response.json(); }).then((data) => setData(validateTerritoryDataset(data))).catch((error) => { if (!controller.signal.aborted) setError(String(error)); });
    return () => controller.abort();
  }, [retry]);
  if (error) return <Card title="Mapa territorial"><p role="alert">{error}</p><ActionButton onClick={() => setRetry(retry + 1)}>Tentar carregar mapa</ActionButton></Card>;
  if (!data) return <Card><p role="status">Carregando a malha dos 853 municípios…</p></Card>;
  return <TerritoryWorkspace data={data} />;
}
function TerritoryWorkspace({ data }: { data: TerritoryDataset }) {
  const { state, update, persistenceMessage } = useApp();
  const builtins = useMemo(() => ibgeRegionalizations(data), [data]);
  const schemes = useMemo(() => [...builtins, ...(state.territory?.regionalizations || [])], [builtins, state.territory?.regionalizations]);
  const [schemeId, setSchemeId] = useState('ibge-intermediate'), [department, setDepartment] = useState('');
  const [seriesId, setSeriesId] = useState(''), [colorMode, setColorMode] = useState<'indicator' | 'regions'>('regions');
  const [level, setLevel] = useState<'municipality' | 'region'>('municipality'), [method, setMethod] = useState<'equal' | 'quantile'>('equal'), [reversed, setReversed] = useState(false);
  const [selected, setSelected] = useState('3106200'), [query, setQuery] = useState(''), [regionFilter, setRegionFilter] = useState('');
  const [importing, setImporting] = useState<'series' | 'regions' | null>(null), [editing, setEditing] = useState('');
  const [valueEntry, setValueEntry] = useState(''), [valueError, setValueError] = useState('');
  const scheme = schemes.find((record) => record.id === schemeId);
  const series = state.territory?.series.find((record) => record.id === seriesId);
  const municipality = data.municipalities.find((m) => m.code === selected)!;
  const regional = useMemo(() => series && scheme ? regionalValues(data, series, scheme) : {}, [data, series, scheme]);
  const regionalMode = level === 'region' && !!scheme && !!series && series.aggregation !== 'none';
  const numericValue = (code: string) => regionalMode ? regional[scheme!.memberships[code]]?.value : series?.values[code];
  const scale = colorScale(regionalMode ? Object.values(regional).map((record) => record.value) : Object.values(series?.values || {}), method, reversed);
  const regionColor = (id: string | undefined) => { const index = scheme?.regions.findIndex((region) => region.id === id) ?? -1; return index < 0 ? NO_DATA_COLOR : REGION_PALETTE[index] || `hsl(${(index * 137.508) % 360} 40% 58%)`; };
  const fill = (code: string) => colorMode === 'regions' ? regionColor(scheme?.memberships[code]) : scale.color(numericValue(code));
  const valueLabel = (code: string) => colorMode === 'regions' ? scheme?.regions.find((region) => region.id === scheme.memberships[code])?.name || 'Sem região atribuída' : number(numericValue(code)) + (numericValue(code) !== null && numericValue(code) !== undefined ? ' ' + (series?.unit || '') : '');
  const activeRegion = scheme?.regions.find((region) => region.id === scheme.memberships[selected]);
  const departments = [...new Set(schemes.map((record) => record.department))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const availableSchemes = schemes.filter((record) => !department || record.department === department);
  const matching = data.municipalities.filter((m) => (!query || normalizeTerritoryText(m.name + ' ' + m.code).includes(normalizeTerritoryText(query))) && (!regionFilter || scheme?.memberships[m.code] === regionFilter));
  const observed = data.municipalities.filter((m) => typeof series?.values[m.code] === 'number').length;
  const localScheme = state.territory?.regionalizations.find((record) => record.id === schemeId);
  const canCreate = canEditTerritory(state);
  const selectScheme = (id: string) => { setSchemeId(id); setRegionFilter(''); setLevel('municipality'); };
  useEffect(() => { const value = series?.values[selected]; setValueEntry(value === null || value === undefined ? '' : String(value).replace('.', ',')); setValueError(''); }, [series?.values[selected], seriesId, selected]);
  const exportValues = () => downloadTerritoryText('indicador-municipal.csv', '\uFEFFcodigo_ibge;municipio;valor;unidade;periodo;regiao\n' + data.municipalities.map((m) => [m.code, m.name, series?.values[m.code] === null || series?.values[m.code] === undefined ? '' : String(series.values[m.code]).replace('.', ','), series?.unit || '', series?.period || '', scheme?.regions.find((r) => r.id === scheme.memberships[m.code])?.name || ''].map(csvCell).join(';')).join('\n'));
  const saveValue = () => { try { const value = parseTerritoryNumber(valueEntry); update((draft) => { const target = draft.territory?.series.find((item) => item.id === seriesId); if (target) target.values[selected] = value; }); setValueError(''); } catch (cause) { setValueError(String(cause)); } };
  return <div className="ppo-sheet territory-workspace">
    <Card>
      <header className="project-heading"><span className="project-heading-icon"><MapPinned size={24} /></span><div><span className="planning-eyebrow">Municípios, regiões e indicadores</span><h2>Mapa territorial de Minas Gerais</h2><p>853 municípios · regionalizações independentes por secretaria</p></div><span className="badge blue">Malha IBGE</span></header>
      <div className="territory-primary-actions"><ActionButton icon={<Upload size={15} />} disabled={!canCreate} onClick={() => setImporting('series')}>Importar valores de indicador</ActionButton><ActionButton color="ghost" disabled={!canCreate} onClick={() => setImporting('regions')}>Criar regionalização</ActionButton><ActionButton color="ghost" icon={<Download size={15} />} onClick={() => downloadTerritoryText('dados-territoriais.json', JSON.stringify({ schemaVersion: 1, meshSource: data.source, territory: state.territory || { schemaVersion: 1, regionalizations: [], series: [] } }, null, 2), 'application/json')}>Exportar dados territoriais</ActionButton></div>
      <div className="territory-filters">
        <label className="field">Secretaria / órgão<select aria-label="Secretaria da regionalização" value={department} onChange={(event) => { const selected = event.target.value; setDepartment(selected); if (scheme && selected && scheme.department !== selected) selectScheme(schemes.find((s) => s.department === selected)?.id || ''); }}><option value="">Todas</option>{departments.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="field">Regionalização<select aria-label="Regionalização do mapa" value={schemeId} onChange={(event) => selectScheme(event.target.value)}><option value="">Municípios sem agrupamento</option>{availableSchemes.map((record) => <option key={record.id} value={record.id}>{record.name}{record.referenceYear ? ' · ' + record.referenceYear : ''} · {record.department}</option>)}</select></label>
        <label className="field">Indicador / período<select aria-label="Indicador e período do mapa" value={seriesId} onChange={(event) => { setSeriesId(event.target.value); setLevel('municipality'); if (event.target.value) setColorMode('indicator'); }}><option value="">Nenhum indicador importado</option>{state.territory?.series.map((record) => <option key={record.id} value={record.id}>{record.name} · {record.period} · {record.unit}</option>)}</select></label>
        <label className="field">Colorir por<select aria-label="Colorir mapa por" value={colorMode} onChange={(event) => setColorMode(event.target.value as 'indicator' | 'regions')}><option value="regions">Região atribuída</option><option value="indicator">Valor do indicador</option></select></label>
      </div>
      <div className="territory-secondary-tools">
        {localScheme && <ActionButton sm color="ghost" onClick={() => setEditing(localScheme.id)}>{canEditTerritory(state, localScheme) ? 'Editar regionalização' : 'Consultar regionalização'}</ActionButton>}
        {colorMode === 'indicator' && <><label className="field">Leitura dos valores<select aria-label="Leitura dos valores" value={regionalMode ? 'region' : 'municipality'} onChange={(event) => setLevel(event.target.value as 'municipality' | 'region')}><option value="municipality">Por município</option><option value="region" disabled={!scheme || !series || series.aggregation === 'none'}>Por região</option></select></label><label className="field">Faixas de cores<select aria-label="Faixas de cores" value={method} onChange={(event) => setMethod(event.target.value as 'equal' | 'quantile')}><option value="equal">Intervalos iguais</option><option value="quantile">Quantis</option></select></label><label className="territory-check"><input type="checkbox" checked={reversed} onChange={(event) => setReversed(event.target.checked)} />Inverter cores</label></>}
        <label className="field">Destacar região<select aria-label="Destacar região" value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}><option value="">Todas as regiões</option>{scheme?.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>
      </div>
      {!series && <p className="alert info">O mapa mostra as divisões territoriais. Importe valores municipais para visualizar um indicador; as fichas do planejamento não possuem, por si só, observações para cada município.</p>}
      {series && colorMode === 'indicator' && <p className="territory-source-line"><strong>{series.name}</strong> · {series.period} · {series.unit} · {observed} de 853 municípios com dados · Fonte: {series.source}{regionalMode && <span> · {series.aggregation === 'sum' ? 'Soma' : 'Média simples, não ponderada'} dos municípios com dados</span>}</p>}
      <div className="territory-layout"><div>
        <TerritoryMap data={data} scheme={scheme} color={fill} valueLabel={valueLabel} selected={selected} onSelect={setSelected} regionFilter={regionFilter} />
        <div className="territory-legend" aria-label="Legenda do mapa"><strong>{colorMode === 'regions' ? scheme?.name || 'Municípios' : series?.unit || 'Valores'}</strong>
          {colorMode === 'regions' ? scheme?.regions.map((region) => <button key={region.id} className={regionFilter === region.id ? 'active' : ''} onClick={() => setRegionFilter(regionFilter === region.id ? '' : region.id)}><i style={{ background: regionColor(region.id) }} />{region.name}</button>) : scale.bins.map((bin, index) => <span key={index}><i style={{ background: bin.color }} />{index ? '> ' : ''}{number(bin.lower)}{bin.upper !== bin.lower ? ' a ' + number(bin.upper) : ''}</span>)}
          <span><i style={{ background: NO_DATA_COLOR }} />{colorMode === 'regions' ? 'Sem região atribuída' : 'Sem dados'}</span>
        </div>
      </div><aside className="territory-details" aria-label="Detalhes do município">
        <span className="planning-eyebrow">Município selecionado</span><h3>{municipality.name}</h3><dl><div><dt>Código IBGE</dt><dd>{municipality.code}</dd></div><div><dt>Regionalização</dt><dd>{scheme?.name || 'Sem agrupamento'}</dd></div><div><dt>Região</dt><dd>{activeRegion?.name || 'Sem região atribuída'}</dd></div><div><dt>Valor municipal</dt><dd className="territory-value">{number(series?.values[selected])}{series?.values[selected] !== null && series?.values[selected] !== undefined ? ' ' + series.unit : ''}</dd></div>{regionalMode && <div><dt>Valor da região · {series?.aggregation === 'sum' ? 'soma' : 'média simples'}</dt><dd>{number(regional[scheme!.memberships[selected]]?.value)} · {regional[scheme!.memberships[selected]]?.observed || 0}/{regional[scheme!.memberships[selected]]?.total || 0} municípios com dados</dd></div>}</dl>
        {series && canEditTerritory(state, series) && <div className="territory-value-editor"><FormField label="Valor do município selecionado" value={valueEntry} onChange={setValueEntry} /><p className="small muted">Deixe vazio para registrar ausência de dado.</p><ActionButton sm onClick={saveValue}>Salvar valor municipal</ActionButton>{valueError && <p className="alert err" role="alert">{valueError}</p>}</div>}
        <FormField label="Pesquisar município no mapa" value={query} onChange={setQuery} />
        <div className="territory-municipality-results" aria-label="Municípios encontrados">{matching.slice(0, 30).map((m) => <button key={m.code} aria-pressed={m.code === selected} onClick={() => setSelected(m.code)}><span>{m.name}<small>{m.code}</small></span><b>{series ? number(series.values[m.code]) : ''}</b></button>)}</div><p className="small muted">{matching.length} municípios encontrados{matching.length > 30 ? ' · refine a pesquisa para ver outros' : ''}</p>
        <ActionButton sm color="ghost" disabled={!series} onClick={exportValues}>Exportar valores em CSV</ActionButton>
      </aside></div>
      <details className="reference-panel"><summary>Fonte da malha e critérios</summary><p>Malha simplificada e catálogo municipal do IBGE, consultados em {new Date(data.source.fetchedAt).toLocaleDateString('pt-BR')}. A malha é destinada à visualização; a fonte não informa nesta consulta um ano que deva ser confundido com o período dos indicadores.</p><p>As divisões locais são propostas da secretaria cadastradas nesta aplicação. Não substituem as regionalizações oficiais do IBGE. Uma região pode ficar parcialmente sem dados; a leitura regional informa quantos municípios possuem valores.</p><a href={data.source.meshUrl} target="_blank" rel="noreferrer">Malha IBGE</a> · <a href={data.source.localitiesUrl} target="_blank" rel="noreferrer">Catálogo municipal IBGE</a></details>
      {persistenceMessage.startsWith('Não') && <p className="alert err" role="alert">{persistenceMessage}</p>}
    </Card>
    {importing && <TerritoryImport data={data} kind={importing} onClose={() => setImporting(null)} onCreated={(id) => { if (importing === 'series') { setSeriesId(id); setColorMode('indicator'); setLevel('municipality'); } else { setDepartment(''); selectScheme(id); setColorMode('regions'); setEditing(id); } setImporting(null); }} />}
    {editing && <RegionalizationEditor id={editing} data={data} initialCode={selected} onClose={() => setEditing('')} />}
  </div>;
}
