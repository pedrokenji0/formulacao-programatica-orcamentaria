import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../../store/AppStore';
import { ActionButton, FormField, Modal } from '../../components/ui';
import { createRegionalization, createTerritorialSeries, EMPTY_TERRITORY, parseTerritorialRows } from '../../services/territoryDomain';
import { projectMapsForProgram } from '../../services/projectMapDomain';
import type { TerritorialSeries, TerritoryDataset } from '../../types';

export function downloadTerritoryText(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export function TerritoryImport({ data, kind, onClose, onCreated }: { data: TerritoryDataset; kind: 'series' | 'regions'; onClose: () => void; onCreated: (id: string) => void }) {
  const { state, reference, update } = useApp();
  const [name, setName] = useState(''), [department, setDepartment] = useState(state.unidade.replace(/^\d+\s*[-—]\s*/, ''));
  const [period, setPeriod] = useState(''), [year, setYear] = useState(reference.manifest.exercise), [unit, setUnit] = useState(''), [source, setSource] = useState('');
  const [indicator, setIndicator] = useState(''), [aggregation, setAggregation] = useState<TerritorialSeries['aggregation']>('none');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]), [file, setFile] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const projectIndicators = projectMapsForProgram(state, state.currentProgramId).flatMap((map) => map.indicators.map((item) => ({ value: 'project:' + map.id + ':' + item.id, name: item.name, unit: item.unit, ref: { kind: 'project' as const, mapId: map.id, indicatorId: item.id } })));
  const ppoIndicators = [...reference.indicators.map((item) => state.planning?.indicatorProposals[item.id] || item), ...(state.planning?.localIndicators || [])].filter((item) => item.programId === state.currentProgramId).map((item) => ({ value: 'ppo:' + item.id, name: item.fields.Indicador, unit: item.fields['Unidade de Medida'], ref: { kind: 'ppo' as const, indicatorId: item.id } }));
  const indicators = [...projectIndicators, ...ppoIndicators];
  const read = async (input: File) => {
    setError(''); setBusy(true); setRows([]); setFile('');
    try {
      const book = XLSX.read(await input.arrayBuffer(), { type: 'array', codepage: 65001 });
      if (!book.SheetNames.length) throw new Error('Planilha vazia.');
      const values = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: '', raw: true });
      parseTerritorialRows(values, data, kind);
      setRows(values); setFile(input.name);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  const create = () => {
    setError('');
    try {
      const record = kind === 'regions' ? createRegionalization(state, data, { name, department, referenceYear: year, source: file || 'Cadastro manual', rows: rows.length ? rows : undefined }) : createTerritorialSeries(state, data, { name, period, unit, source: source + (file ? ' · ' + file : ''), aggregation, indicatorRef: indicators.find((item) => item.value === indicator)?.ref || null, rows });
      update((draft) => { draft.territory ||= EMPTY_TERRITORY(); if (kind === 'regions') draft.territory.regionalizations.push(record as ReturnType<typeof createRegionalization>); else draft.territory.series.push(record as TerritorialSeries); });
      onCreated(record.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <Modal wide title={kind === 'series' ? 'Importar valores de indicador' : 'Criar regionalização'} onClose={onClose} foot={<><ActionButton color="ghost" onClick={onClose}>Cancelar</ActionButton><ActionButton disabled={busy || !name.trim() || (kind === 'series' && (!rows.length || !period.trim() || !unit.trim() || !source.trim())) || (kind === 'regions' && (!department.trim() || !/^\d{4}$/.test(year)))} onClick={create}>{kind === 'series' ? 'Importar valores' : 'Criar regionalização'}</ActionButton></>}>
    <div className="project-record-editor"><section className="sheet-section">
      {kind === 'series' && <label className="field">Indicador do planejamento (opcional)<select aria-label="Indicador do planejamento" value={indicator} onChange={(event) => { const choice = indicators.find((item) => item.value === event.target.value); setIndicator(event.target.value); if (choice) { setName(choice.name); setUnit(choice.unit || ''); } }}><option value="">Sem vínculo com ficha existente</option>{indicators.map((item) => <option key={item.value} value={item.value}>{item.name || 'Indicador em rascunho'}</option>)}</select></label>}
      <FormField label={kind === 'series' ? 'Nome do indicador territorial' : 'Nome da regionalização'} value={name} onChange={setName} />
      {kind === 'regions' ? <div className="grid g2"><FormField label="Secretaria ou órgão da regionalização" value={department} onChange={setDepartment} /><FormField label="Ano de referência da regionalização" value={year} onChange={setYear} /></div> : <>
        <div className="grid g2"><FormField label="Período dos valores" value={period} onChange={setPeriod} /><FormField label="Unidade dos valores" value={unit} onChange={setUnit} /></div>
        <FormField label="Fonte dos valores" value={source} onChange={setSource} />
        <label className="field">Cálculo por região<select aria-label="Cálculo por região" value={aggregation} onChange={(event) => setAggregation(event.target.value as TerritorialSeries['aggregation'])}><option value="none">Não agregar — manter valores municipais</option><option value="sum">Somar valores municipais</option><option value="mean">Média simples dos municípios com dados</option></select></label>
        <p className="small muted">Percentuais e taxas exigem critérios próprios de agregação. A média simples considera os municípios com dados e não é uma média ponderada.</p>
      </>}
    </section><section className="sheet-section"><h2>{kind === 'regions' ? 'Municípios por região' : 'Valores por município'}</h2>
      <p>{kind === 'regions' ? 'Importe codigo_ibge e regiao ou comece sem planilha e atribua municípios no editor.' : 'Importe as colunas codigo_ibge e valor. Células vazias significam ausência de dado; zero permanece zero.'}</p>
      <input aria-label={kind === 'regions' ? 'Planilha de regionalização' : 'Planilha de valores municipais'} type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={(event) => { if (event.target.files?.[0]) void read(event.target.files[0]); }} />
      <ActionButton sm color="ghost" onClick={() => downloadTerritoryText(kind === 'regions' ? 'modelo-regionalizacao.csv' : 'modelo-indicador-municipal.csv', kind === 'regions' ? 'codigo_ibge;regiao\n3106200;Região de exemplo\n' : 'codigo_ibge;valor\n3106200;\n')}>Baixar modelo CSV</ActionButton>
      {file && <p role="status">{file} · {rows.length} municípios validados</p>}
      {busy && <p role="status">Validando municípios…</p>}
      {!!rows.length && <div className="table-wrap"><table className="dt"><thead><tr><th>Município</th><th>{kind === 'regions' ? 'Região' : 'Valor'}</th></tr></thead><tbody>{parseTerritorialRows(rows, data, kind).slice(0, 5).map((item) => <tr key={item.code}><td>{data.municipalities.find((m) => m.code === item.code)?.name} · {item.code}</td><td>{kind === 'regions' ? item.region : item.value === null ? 'Sem dados' : item.value.toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div>}
      {error && <p className="alert err" role="alert">{error}</p>}
    </section></div>
  </Modal>;
}
