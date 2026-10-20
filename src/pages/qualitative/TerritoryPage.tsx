import { useEffect, useMemo, useState } from 'react';
import { Download, MapPinned, Upload } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { ActionButton, Card, FormField } from '../../components/ui';
import { HelpTip } from '../../components/HelpTip';
import { planningTargetSeries, planningBudgetSeries, planningProjects, planningCycle, planningYears, planningTerritoryCatalog, planningRegionalValues, planningReferenceTotals, isIntermediateScheme, formatBudget } from '../../services/planningTerritoryReference';
import { referenceRegionalizations, fjpRegionalizationSource } from '../../services/fjpTerritoryReference';
import { TerritoryMap } from '../../components/TerritoryMap';
import { canEditTerritory, colorScale, NO_DATA_COLOR, normalizeTerritoryText, parseTerritoryNumber, regionalValues, REGION_PALETTE, validateTerritoryDataset } from '../../services/territoryDomain';
import { BudgetDistribution } from './BudgetDistribution';
import { RegionalizationEditor } from './RegionalizationEditor';
import { TerritoryImport, downloadTerritoryText } from './TerritoryImport';
import type { TerritoryDataset } from '../../types';

const number = (value: number | null | undefined) => value === null || value === undefined ? 'Sem dados' : value.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const csvCell = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
const years = planningYears(planningCycle.revisionYear);

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
  const builtins = useMemo(() => referenceRegionalizations(data), [data]);
  const schemes = useMemo(() => [...builtins, ...(state.territory?.regionalizations || [])], [builtins, state.territory?.regionalizations]);
  const allSeries = useMemo(() => [...planningTargetSeries, ...planningBudgetSeries, ...(state.territory?.series || [])], [state.territory?.series]);
  const defaultSeries = planningTargetSeries.find((record) => record.reference?.actionCode === '1082' && record.period === planningCycle.revisionYear) || planningTargetSeries[0];
  const [schemeId, setSchemeId] = useState('ibge-intermediate'), [department, setDepartment] = useState('');
  const [seriesId, setSeriesId] = useState(defaultSeries?.id || ''), [colorMode, setColorMode] = useState<'indicator' | 'regions'>('indicator');
  const [level, setLevel] = useState<'municipality' | 'region'>('region'), [method, setMethod] = useState<'equal' | 'quantile'>('equal'), [reversed, setReversed] = useState(false);
  const [selected, setSelected] = useState('3106200'), [query, setQuery] = useState(''), [regionFilter, setRegionFilter] = useState('');
  const [importing, setImporting] = useState<'series' | 'regions' | null>(null), [editing, setEditing] = useState('');
  const [localizerPage, setLocalizerPage] = useState(0), [localizerQuery, setLocalizerQuery] = useState('');
  const [valueEntry, setValueEntry] = useState(''), [valueError, setValueError] = useState(''), [showStatewide, setShowStatewide] = useState(true);
  const scheme = schemes.find((record) => record.id === schemeId);
  const series = allSeries.find((record) => record.id === seriesId);
  const project = planningProjects.find((record) => record.code === series?.reference?.projectCode);
  const action = project?.actions.find((record) => record.id === series?.reference?.actionId);
  const isBudget = series?.reference?.kind === 'budget-forecast';
  const targetTotals = series ? planningReferenceTotals(series) : null;
  const displayValue = (value: number | null | undefined) => isBudget ? formatBudget(value) : number(value);
  const hasStatewide = (targetTotals?.state ?? 0) > 0;
  const statewideShare = targetTotals?.total && targetTotals.state !== null ? (targetTotals.state / targetTotals.total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%' : null;
  const statewideLocalizers = series?.reference?.observations.filter((row) => row.scope === 'state' && row.value !== null && row.value > 0).map((row) => row.localizerCode).join(', ');
  const statewideLabel = (isBudget ? 'Recursos' : 'Metas') + ' em localizador estadual — sem distribuição municipal';
  const statewideHelp = 'Localizador ' + statewideLocalizers + ' · ' + series?.period + '. A base informa abrangência estadual, sem discriminar a divisão entre municípios ou os municípios atendidos. A hachura indica essa classificação e não representa valor por município.';
  const targetCompatible = useMemo(() => isIntermediateScheme(data, scheme), [data, scheme]);
  const hasRegionalSource = !!series?.reference?.observations.some((row) => row.scope === 'intermediate' && row.value !== null);
  const incompatibleSource = hasRegionalSource && !targetCompatible;
  const municipality = data.municipalities.find((m) => m.code === selected)!;
  const regional = useMemo(() => series && scheme ? series.reference ? planningRegionalValues(data, series, scheme) : regionalValues(data, series, scheme) : {}, [data, series, scheme]);
  const regionalMode = level === 'region' && !!scheme && !!series && series.aggregation !== 'none';
  const numericValue = (code: string) => regionalMode ? regional[scheme!.memberships[code]]?.value : series?.values[code];
  const scale = colorScale(regionalMode ? Object.values(regional).map((record) => record.value) : Object.values(series?.values || {}), method, reversed);
  const regionColor = (id: string | undefined) => { const index = scheme?.regions.findIndex((region) => region.id === id) ?? -1; return index < 0 ? NO_DATA_COLOR : REGION_PALETTE[index] || `hsl(${(index * 137.508) % 360} 40% 58%)`; };
  const fill = (code: string) => colorMode === 'regions' ? regionColor(scheme?.memberships[code]) : scale.color(numericValue(code));
  const valueLabel = (code: string) => colorMode === 'regions' ? scheme?.regions.find((region) => region.id === scheme.memberships[code])?.name || 'Sem região atribuída' : (series?.reference && regionalMode ? (isBudget ? 'Recursos da região: ' : 'Meta da região: ') : '') + displayValue(numericValue(code)) + (!isBudget && numericValue(code) !== null && numericValue(code) !== undefined ? ' ' + (series?.unit || '') : '');
  const regionalCoverage = scheme ? regional[scheme.memberships[selected]] : undefined;
  const activeRegion = scheme?.regions.find((region) => region.id === scheme.memberships[selected]);
  const departments = [...new Set(schemes.map((record) => record.department))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const availableSchemes = schemes.filter((record) => !department || record.department === department);
  const matching = data.municipalities.filter((m) => (!query || normalizeTerritoryText(m.name + ' ' + m.code).includes(normalizeTerritoryText(query))) && (!regionFilter || scheme?.memberships[m.code] === regionFilter));
  const observed = data.municipalities.filter((m) => typeof series?.values[m.code] === 'number').length;
  const matchingLocalizers = (series?.reference?.observations || []).filter((row) => normalizeTerritoryText(row.localizerCode + ' ' + row.territoryName).includes(normalizeTerritoryText(localizerQuery)));
  const localizerPages = Math.max(1, Math.ceil(matchingLocalizers.length / 50));
  const visibleLocalizers = matchingLocalizers.slice(Math.min(localizerPage, localizerPages - 1) * 50, (Math.min(localizerPage, localizerPages - 1) + 1) * 50);
  const localScheme = state.territory?.regionalizations.find((record) => record.id === schemeId);
  const canCreate = canEditTerritory(state);
  const selectScheme = (id: string) => {
    const compatible = isIntermediateScheme(data, schemes.find((record) => record.id === id));
    setSchemeId(id); setRegionFilter('');
    if (series?.reference) {
      setColorMode(hasRegionalSource && !compatible ? 'regions' : 'indicator');
      if (hasRegionalSource) setLevel(compatible ? 'region' : 'municipality');
    }
  };
  const selectSeries = (id: string, reset = true) => {
    const record = allSeries.find((record) => record.id === id);
    setSeriesId(id); setColorMode('indicator');
    if (!reset) return;
    setRegionFilter(''); setQuery(''); setLocalizerPage(0); setLocalizerQuery('');
    const municipal = record && Object.values(record.values).some((value) => value !== null);
    const coarse = record?.reference?.observations.some((row) => row.scope === 'intermediate' && row.value !== null);
    setLevel(municipal || !record?.reference ? 'municipality' : 'region');
    if (coarse && !targetCompatible) { setDepartment(''); setSchemeId('ibge-intermediate'); }
    const firstMunicipality = record?.reference?.observations.find((row) => row.scope === 'municipality' && row.value !== null)?.territoryCode;
    const firstRegion = record?.reference?.observations.find((row) => row.scope === 'intermediate' && row.value !== null)?.territoryCode;
    const selectedCode = firstMunicipality || data.municipalities.find((m) => m.intermediate.code === firstRegion)?.code;
    if (selectedCode) setSelected(selectedCode);
  };
  const selectAction = (id: string, kind = series?.reference?.kind || 'physical-target', year = series?.reference ? series.period : planningCycle.revisionYear) => {
    const record = allSeries.find((record) => record.reference?.actionId === id && record.reference.kind === kind && record.period === year);
    if (record) selectSeries(record.id);
  };
  const selectProject = (code: string) => {
    if (code === 'local') { selectSeries(state.territory?.series[0]?.id || ''); return; }
    const records = planningTargetSeries.filter((record) => record.reference?.projectCode === code && record.period === (series?.reference ? series.period : planningCycle.revisionYear));
    const ranked = records.map((record) => ({ record, count: Object.values(record.values).filter((value) => typeof value === 'number' && value > 0).length })).sort((a, b) => b.count - a.count);
    if (ranked[0]) selectAction(ranked[0].record.reference!.actionId);
  };
  const selectMeasure = (kind: 'physical-target' | 'budget-forecast') => {
    const record = allSeries.find((record) => record.reference?.actionId === series?.reference?.actionId && record.reference?.kind === kind && record.period === series?.period);
    if (record) selectSeries(record.id, false);
  };
  const selectYear = (year: string) => {
    const record = allSeries.find((record) => record.reference?.actionId === action?.id && record.reference?.kind === series?.reference?.kind && record.period === year);
    if (record) selectSeries(record.id, false);
  };
  useEffect(() => { const value = series?.values[selected]; setValueEntry(value === null || value === undefined ? '' : String(value).replace('.', ',')); setValueError(''); }, [series?.values[selected], seriesId, selected]);
  const exportValues = () => {
    if (series?.reference) {
      const target = series.reference;
      downloadTerritoryText((isBudget ? 'recursos-acao-' : 'metas-fisicas-acao-') + target.actionCode + '-' + series.period + '.csv', '\uFEFFnivel_territorial;codigo_territorial;territorio;localizador;acao;uo;periodo;produto;unidade;valor;fonte\n' + target.observations.map((row) => [row.scope, row.territoryCode, row.territoryName, row.localizerCode, target.actionCode, series.ownerUnit, series.period, target.product, series.unit, row.value === null ? '' : String(row.value).replace('.', ','), series.source].map(csvCell).join(';')).join('\n'));
      return;
    }
    downloadTerritoryText('indicador-municipal.csv', '\uFEFFcodigo_ibge;municipio;valor;unidade;periodo;regiao\n' + data.municipalities.map((m) => [m.code, m.name, series?.values[m.code] === null || series?.values[m.code] === undefined ? '' : String(series.values[m.code]).replace('.', ','), series?.unit || '', series?.period || '', scheme?.regions.find((r) => r.id === scheme.memberships[m.code])?.name || ''].map(csvCell).join(';')).join('\n'));
  };
  const saveValue = () => { try { const value = parseTerritoryNumber(valueEntry); update((draft) => { const target = draft.territory?.series.find((item) => item.id === seriesId); if (target) target.values[selected] = value; }); setValueError(''); } catch (cause) { setValueError(String(cause)); } };

  return <div className="ppo-sheet territory-workspace territory-compact">
    <Card>
      <header className="project-heading territory-heading"><span className="project-heading-icon"><MapPinned size={24} /></span><div><span className="planning-eyebrow">Planejamento</span><h2>Mapa territorial de Minas Gerais</h2></div><HelpTip label="Sobre o mapa territorial" text="853 municípios do IBGE. Consulte metas físicas, recursos previstos e regionalizações de cada secretaria. A abrangência dos localizadores de origem é preservada." /></header>
      <div className="territory-selection">
        <label className="field">Projeto estratégico<select aria-label="Projeto estratégico do mapa" value={project?.code || 'local'} onChange={(event) => selectProject(event.target.value)}>{planningProjects.map((record) => <option key={record.code} value={record.code}>{record.code} · {record.name}</option>)}<option value="local">Indicadores locais</option></select></label>
        {project ? <label className="field">Ação<select aria-label="Ação do mapa" value={action?.id || ''} onChange={(event) => selectAction(event.target.value)}>{project.actions.map((record) => <option key={record.id} value={record.id}>{record.code} · {record.name} · UO {record.ownerUnit}</option>)}</select></label> : <label className="field">Indicador local<select aria-label="Indicador local do mapa" value={seriesId} onChange={(event) => selectSeries(event.target.value)}><option value="">Selecione um indicador</option>{state.territory?.series.map((record) => <option key={record.id} value={record.id}>{record.name} · {record.period}</option>)}</select></label>}
        <label className="field">Regionalização<select aria-label="Regionalização do mapa" value={schemeId} onChange={(event) => selectScheme(event.target.value)}><option value="">Sem agrupamento</option>{availableSchemes.map((record) => <option key={record.id} value={record.id}>{record.name} · {record.department}</option>)}</select></label>
      </div>
      {series?.reference && <div className="territory-cycle-bar">
        <div className="territory-measures" role="group" aria-label="Medida no mapa"><ActionButton sm color={!isBudget ? 'blue' : 'ghost'} aria-pressed={!isBudget} onClick={() => selectMeasure('physical-target')}>Metas físicas</ActionButton><ActionButton sm color={isBudget ? 'blue' : 'ghost'} aria-pressed={isBudget} onClick={() => selectMeasure('budget-forecast')}>Recursos orçamentários</ActionButton></div>
        <div className="territory-year-control"><div><span>Revisão {planningCycle.revisionYear}</span><output aria-live="polite">{series.period}</output><HelpTip label="Ciclo de anos do planejamento" text={`Base elaborada em ${planningCycle.preparedIn}. O ciclo começa no ano de revisão (${planningCycle.revisionYear}) e inclui os três anos seguintes. Os valores de cada ano vêm das respectivas colunas da fonte.`} /></div><input type="range" min={years[0]} max={years[years.length - 1]} step="1" value={series.period} aria-label="Ano do planejamento" aria-valuetext={series.period} onChange={(event) => selectYear(event.target.value)} /><div className="territory-year-ticks">{years.map((year) => <button key={year} aria-label={'Selecionar ano ' + year} aria-pressed={series.period === year} onClick={() => selectYear(year)}>{year}</button>)}</div></div>
      </div>}
      {series?.reference && <section className={'physical-target-summary' + (isBudget ? ' budget-summary' : '')} aria-label={isBudget ? 'Resumo dos recursos orçamentários' : 'Resumo das metas físicas'}>
        <div className="territory-summary-heading"><strong>Ação {series.reference.actionCode}</strong><span>UO {series.ownerUnit} · {series.unit}</span><HelpTip label="Origem e conferência dos valores" text={<><strong>{action?.name}</strong><p>{series.reference.product} · {series.source}</p><p>{targetTotals?.reconciled ? 'Total conferido com a previsão da ação.' : 'Confira os totais da origem.'} Total da ação: {displayValue(targetTotals?.actionTotal)}. Localizadores: {displayValue(targetTotals?.total)}.</p><p>A cor regional representa o valor da região inteira; a parcela estadual tem indicação própria, sem rateio entre municípios. Valores previstos no planejamento.</p></>} /></div>
        <dl><div><dt>Total dos localizadores</dt><dd>{displayValue(targetTotals?.total)}</dd></div><div><dt>Estadual</dt><dd>{displayValue(targetTotals?.state)}</dd></div><div><dt>Regional</dt><dd>{displayValue(targetTotals?.intermediate)}</dd></div><div><dt>Municipal</dt><dd>{displayValue(targetTotals?.municipality)}</dd></div></dl>
        {targetTotals && !targetTotals.reconciled && <p className="alert warn" role="status">Totais da origem {targetTotals.total === null ? 'não informados' : 'divergentes'} <HelpTip label="Detalhar diferença entre totais" text={'Localizadores: ' + displayValue(targetTotals.total) + '. Ficha da ação: ' + displayValue(targetTotals.actionTotal) + '.'} /></p>}
      </section>}
      {incompatibleSource && <div className="territory-scope-warning" role="status"><span>Há valores regionais em outro recorte.</span><HelpTip label="Recorte territorial dos valores" text="Os valores por região intermediária permanecem no recorte original. Os valores municipais podem ser agrupados em outras regionalizações; valores regionais não são redistribuídos." /><ActionButton sm color="ghost" onClick={() => { setDepartment(''); setSchemeId('ibge-intermediate'); setLevel('region'); setColorMode('indicator'); setRegionFilter(''); }}>Usar recorte de origem</ActionButton></div>}
      <div className="territory-map-toolbar">
        <div className="territory-source-line">{series ? <><span>{series.unit} · {series.period}</span><span>{observed}/853 municípios</span><HelpTip label="Fonte e cobertura do mapa" text={series.name + '. Fonte: ' + series.source + '. ' + observed + ' municípios com valor individualizado. Cinza indica ausência de valor discriminado. Zero é um valor.'} /></> : <span>Selecione ou importe um indicador.</span>}</div>
        <details className="territory-options"><summary>Opções do mapa</summary><div className="territory-secondary-tools">
          <label className="field">Colorir por<select aria-label="Colorir mapa por" value={colorMode} onChange={(event) => setColorMode(event.target.value as 'indicator' | 'regions')}><option value="indicator">Valor</option><option value="regions">Região atribuída</option></select></label>
          <label className="field">Leitura<select aria-label="Leitura dos valores" value={regionalMode ? 'region' : 'municipality'} onChange={(event) => setLevel(event.target.value as 'municipality' | 'region')}><option value="municipality">Por município</option><option value="region" disabled={!scheme || !series || series.aggregation === 'none'}>Por região</option></select></label>
          <label className="field">Faixas de cores<select aria-label="Faixas de cores" value={method} onChange={(event) => setMethod(event.target.value as 'equal' | 'quantile')}><option value="equal">Intervalos iguais</option><option value="quantile">Quantis</option></select></label><label className="territory-check"><input type="checkbox" checked={reversed} onChange={(event) => setReversed(event.target.checked)} />Inverter cores</label>
          <label className="field">Secretaria<select aria-label="Secretaria da regionalização" value={department} onChange={(event) => { const name = event.target.value; setDepartment(name); if (scheme && name && scheme.department !== name) selectScheme(schemes.find((record) => record.department === name)?.id || ''); }}><option value="">Todas</option>{departments.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label className="field">Destacar região<select aria-label="Destacar região" value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}><option value="">Todas as regiões</option>{scheme?.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>
        </div></details>
        {localScheme && <ActionButton sm color="ghost" onClick={() => setEditing(localScheme.id)}>{canEditTerritory(state, localScheme) ? 'Editar regionalização' : 'Consultar regionalização'}</ActionButton>}
      </div>
      <div className="territory-layout"><div>
        {hasStatewide && <section className="statewide-map-notice" aria-label={isBudget ? 'Recursos com abrangência estadual' : 'Metas com abrangência estadual'}><i className="statewide-pattern-key" aria-hidden="true" /><span>Localizador estadual</span><strong>{displayValue(targetTotals?.state)}</strong>{statewideShare && <b>{statewideShare}</b>}<HelpTip label="Abrangência do localizador estadual" text={statewideHelp} /><label className="territory-check"><input type="checkbox" aria-label="Mostrar abrangência estadual no mapa" checked={showStatewide} onChange={(event) => setShowStatewide(event.target.checked)} />Exibir hachura</label></section>}
        <TerritoryMap data={data} scheme={scheme} color={fill} valueLabel={valueLabel} selected={selected} onSelect={setSelected} regionFilter={regionFilter} statewideLabel={hasStatewide && showStatewide ? statewideLabel : undefined} />
        <div className="territory-legend" aria-label="Legenda do mapa"><strong>{colorMode === 'regions' ? scheme?.name || 'Municípios' : series?.unit || 'Valores'}</strong>{colorMode === 'regions' ? scheme?.regions.map((region) => <button key={region.id} className={regionFilter === region.id ? 'active' : ''} onClick={() => setRegionFilter(regionFilter === region.id ? '' : region.id)}><i style={{ background: regionColor(region.id) }} />{region.name}</button>) : scale.bins.map((bin, index) => <span key={index}><i style={{ background: bin.color }} />{index ? '> ' : ''}{displayValue(bin.lower)}{bin.upper !== bin.lower ? ' a ' + displayValue(bin.upper) : ''}</span>)}{hasStatewide && <span><i className="statewide-pattern-key" />Estadual{showStatewide ? '' : ' · oculta'} <HelpTip label="Hachura da legenda" text={statewideHelp} /></span>}<span><i style={{ background: NO_DATA_COLOR }} />Sem valor discriminado</span></div>
      </div><aside className="territory-details" aria-label="Detalhes do município">
        <span className="planning-eyebrow">Município</span><h3>{municipality.name}</h3><dl><div><dt>Código IBGE</dt><dd>{municipality.code}</dd></div><div><dt>Região</dt><dd>{activeRegion?.name || 'Sem região atribuída'}</dd></div><div><dt>Valor municipal</dt><dd className="territory-value">{displayValue(series?.values[selected])}{!isBudget && series?.values[selected] !== null && series?.values[selected] !== undefined ? ' ' + series.unit : ''}</dd></div>{regionalMode && <div><dt>Valor da região <HelpTip label="Leitura do valor regional" text={series?.reference && hasRegionalSource && targetCompatible ? 'Os valores declarados para regiões inteiras na fonte não possuem divisão municipal.' : series?.aggregation === 'sum' ? 'Soma dos municípios com dados.' : 'Média simples dos municípios com dados. Cobertura: ' + (regionalCoverage?.observed || 0) + '/' + (regionalCoverage?.total || 0) + ' municípios.'} /></dt><dd>{displayValue(regional[scheme!.memberships[selected]]?.value)}</dd></div>}{hasStatewide && <div className="statewide-municipality-note"><dt>Parcela estadual · MG <HelpTip label="Parcela estadual na consulta municipal" text="Total de abrangência estadual, sem divisão por município. Não está incluído no valor municipal ou regional acima." /></dt><dd>{displayValue(targetTotals?.state)}</dd></div>}</dl>
        {series && canEditTerritory(state, series) && <div className="territory-value-editor"><FormField label="Valor do município selecionado" value={valueEntry} onChange={setValueEntry} /><ActionButton sm onClick={saveValue}>Salvar valor municipal</ActionButton>{valueError && <p className="alert err" role="alert">{valueError}</p>}</div>}
        <FormField label="Pesquisar município no mapa" value={query} onChange={setQuery} />
        <div className="territory-municipality-results" aria-label="Municípios encontrados">{matching.slice(0, 20).map((m) => <button key={m.code} aria-pressed={m.code === selected} onClick={() => setSelected(m.code)}><span>{m.name}<small>{m.code}</small></span><b>{series ? displayValue(series.values[m.code]) : ''}</b></button>)}</div><p className="small muted">{matching.length} municípios</p>
        <ActionButton sm color="ghost" disabled={!series} onClick={exportValues}>{isBudget ? 'Exportar recursos em CSV' : series?.reference ? 'Exportar metas em CSV' : 'Exportar valores em CSV'}</ActionButton>
      </aside></div>
      {isBudget && series?.reference && <BudgetDistribution period={series.period} projectCode={series.reference.projectCode} selectedId={series.id} onSelect={(id) => selectSeries(id)} />}
      {series?.reference && <details className="reference-panel territory-localizers" key={series.reference.actionId}><summary>Localizadores de origem ({series.reference.observations.length})</summary><div className="territory-localizer-tools"><FormField label="Pesquisar localizador" value={localizerQuery} onChange={(value) => { setLocalizerQuery(value); setLocalizerPage(0); }} /><span>{matchingLocalizers.length} registros</span></div><div className="table-wrap"><table className="dt"><thead><tr><th>Localizador</th><th>Abrangência</th><th>Território</th><th>{isBudget ? 'Previsão (R$)' : 'Meta'} {series.period}</th><th>Participação</th><th>Registro</th></tr></thead><tbody>{visibleLocalizers.map((row) => <tr key={row.localizerCode}><td>{row.localizerCode}</td><td>{row.scope === 'state' ? 'Estadual' : row.scope === 'intermediate' ? 'Região intermediária' : 'Município'}</td><td>{row.territoryName}</td><td>{displayValue(row.value)}</td><td>{row.value !== null && targetTotals?.total && targetTotals.total > 0 ? (row.value / targetTotals.total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%' : '—'}</td><td>{row.sourceRow}</td></tr>)}</tbody></table></div><div className="territory-pagination"><ActionButton sm color="ghost" disabled={localizerPage === 0} onClick={() => setLocalizerPage(localizerPage - 1)}>Anterior</ActionButton><span>Página {Math.min(localizerPage, localizerPages - 1) + 1} de {localizerPages}</span><ActionButton sm color="ghost" disabled={localizerPage + 1 >= localizerPages} onClick={() => setLocalizerPage(localizerPage + 1)}>Próxima</ActionButton></div></details>}
      <details className="reference-panel territory-data-tools"><summary>Dados, importação e regionalizações</summary><div className="territory-primary-actions"><ActionButton icon={<Upload size={15} />} disabled={!canCreate} onClick={() => setImporting('series')}>Importar valores de indicador</ActionButton><ActionButton color="ghost" disabled={!canCreate} onClick={() => setImporting('regions')}>Criar regionalização</ActionButton><ActionButton color="ghost" icon={<Download size={15} />} onClick={() => downloadTerritoryText('dados-territoriais.json', JSON.stringify({ schemaVersion: 1, cycle: planningCycle, meshSource: data.source, planningCatalog: planningTerritoryCatalog, referenceRegionalizations: builtins, regionalizationSource: fjpRegionalizationSource, territory: state.territory || { schemaVersion: 1, regionalizations: [], series: [] } }, null, 2), 'application/json')}>Exportar dados territoriais</ActionButton></div><p className="small muted">IBGE · malha consultada em {new Date(data.source.fetchedAt).toLocaleDateString('pt-BR')} · Regionalizações FJP/IMRS, edição {fjpRegionalizationSource.edition}.</p><a href={data.source.meshUrl} target="_blank" rel="noreferrer">Malha IBGE</a> · <a href={fjpRegionalizationSource.sourceUrl} target="_blank" rel="noreferrer">Regionalizações FJP</a></details>
      {persistenceMessage.startsWith('Não') && <p className="alert err" role="alert">{persistenceMessage}</p>}
    </Card>
    {importing && <TerritoryImport data={data} kind={importing} onClose={() => setImporting(null)} onCreated={(id) => { if (importing === 'series') { setSeriesId(id); setColorMode('indicator'); setLevel('municipality'); } else { setDepartment(''); selectScheme(id); setColorMode('regions'); setEditing(id); } setImporting(null); }} />}
    {editing && <RegionalizationEditor id={editing} data={data} initialCode={selected} onClose={() => setEditing('')} />}
  </div>;
}
