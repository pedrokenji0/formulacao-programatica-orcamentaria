import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { ActionButton, FormField, useToast } from './ui';
import { OBZ_FIELD_ALIASES, OBZ_FIELD_LABELS, applyBudgetImport, autoMapBudgetHeaders, buildBudgetImport, normalizeHeader } from '../services/obzData';
import type { BudgetItemOBZ, SelectionLists } from '../types';

export function ImportWizard({ onImport, editable = true }: { onImport: (items: BudgetItemOBZ[], lists: Partial<SelectionLists>) => void; editable?: boolean }) {
  const { state } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [rows, setRows] = useState<unknown[][]>([]);
  const [headerIndex, setHeaderIndex] = useState(-1);
  const [rowOffset, setRowOffset] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, number | undefined>>({});
  const [sheetName, setSheetName] = useState('');
  const [fileName, setFileName] = useState('');
  const [batchId, setBatchId] = useState('');
  const [exercise, setExercise] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [imported, setImported] = useState(false);
  const readSequence = useRef(0);
  async function handleFile(file: File) {
    const sequence = ++readSequence.current;
    setBusy(true); setError(''); setRows([]); setHeaders([]); setImported(false); setExercise('');
    try {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
      const workbook = XLSX.read(buffer, { type: 'array' });
      const order = ['BASE OBZ', ...workbook.SheetNames].filter((name, index, all) => all.indexOf(name) === index && workbook.SheetNames.includes(name));
      let chosen = '', data: unknown[][] = [], found = -1;
      for (const name of order) {
        const candidate = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: '' });
        const index = candidate.slice(0, 30).findIndex((row) => row.some((cell) => normalizeHeader(cell) === 'DESCRICAO DO ITEM'));
        if (index >= 0) { chosen = name; data = candidate; found = index; break; }
      }
      if (found < 0) throw new Error('Cabeçalho OBZ não encontrado. Use uma aba com a coluna Descrição do item.');
      if (sequence !== readSequence.current) return;
      const header = data[found].map((cell) => String(cell ?? '').trim());
      setRows(data); setHeaders(header); setHeaderIndex(found); setMapping(autoMapBudgetHeaders(header));
      setSheetName(chosen); setFileName(file.name); setBatchId(hash); setRowOffset(XLSX.utils.decode_range(workbook.Sheets[chosen]['!ref'] || 'A1').s.r);
    } catch (reason) { if (sequence === readSequence.current) setError(String(reason)); }
    finally { if (sequence === readSequence.current) setBusy(false); }
  }
  const preview = useMemo(() => {
    if (!rows.length || !batchId) return { result: null, error: '' };
    try { return { result: buildBudgetImport(rows, headerIndex, mapping, { batchId, file: fileName, sheet: sheetName, headers, exercise, rowOffset }, { programs: state.programs, actions: state.actions, exercise: state.planning?.exercise }), error: '' }; }
    catch (reason) { return { result: null, error: String(reason) }; }
  }, [rows, headerIndex, mapping, batchId, rowOffset, fileName, sheetName, headers, exercise, state.programs, state.actions, state.planning?.exercise]);
  const knownIds = new Set(state.budgetItems.map((item) => item.id));
  const duplicates = preview.result?.items.filter((item) => knownIds.has(item.id)).length || 0;
  return <div className="obz-import">
    <div className="row"><ActionButton icon={<Upload size={16} />} disabled={!editable || busy} onClick={() => fileRef.current?.click()}>{busy ? 'Lendo planilha…' : 'Selecionar planilha'}</ActionButton><input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.target.value = ''; }} />{sheetName && <span className="badge blue"><FileSpreadsheet size={13} />{fileName} · {sheetName}</span>}</div>
    {(error || preview.error) && <div className="alert err" role="alert">{error || preview.error}</div>}
    {!!headers.length && <>
      <p>Confira as colunas e a prévia. Programa, ação e UO são mantidos conforme a planilha. Itens sem vínculo confirmado ficam disponíveis nas pendências da base OBZ.</p>
      <FormField label="Exercício da planilha, quando não houver coluna" value={exercise} placeholder="Não informado" disabled={!editable || imported} onChange={(value) => { setExercise(value); setImported(false); }} hint="Informe apenas se conhecer o exercício. O ano não será deduzido do nome do arquivo nem da base de planejamento." />
      <details><summary>Mapeamento de colunas</summary><div className="grid g3">{Object.keys(OBZ_FIELD_ALIASES).map((field) => <label className="field" key={field}>{OBZ_FIELD_LABELS[field]}{['acao','descricao'].includes(field) && ' *'}<select aria-label={'Coluna: ' + OBZ_FIELD_LABELS[field]} value={mapping[field] ?? ''} disabled={!editable || imported} onChange={(event) => { setMapping((current) => ({ ...current, [field]: event.target.value === '' ? undefined : Number(event.target.value) })); setImported(false); }}><option value="">Não mapear</option>{headers.map((header, index) => <option key={index} value={index}>{header || 'Coluna ' + (index + 1)}</option>)}</select></label>)}</div></details>
      {preview.result && <>
        <div className="alert info" role="status">{preview.result.items.length} itens válidos · {preview.result.linked} com vínculo confirmado · {preview.result.items.length - preview.result.linked} pendentes · {duplicates} já importados.</div>
        {!!preview.result.issues.length && <details><summary>Linhas não importadas ({preview.result.ignored})</summary><ul>{preview.result.issues.map((message) => <li key={message}>{message}</li>)}</ul></details>}
        <div className="table-wrap"><table className="dt"><thead><tr><th>UO de origem</th><th>Programa</th><th>Ação</th><th>Descrição</th><th>Exercício</th><th>Vínculo</th></tr></thead><tbody>{preview.result.items.slice(0,8).map((item) => <tr key={item.id}><td>{item.source?.unitLabel || 'Não informada'}</td><td>{item.source?.programLabel || 'Não informado'}</td><td>{item.acaoLabel}</td><td>{item.descricao}</td><td>{item.exercise || 'Não informado'}</td><td>{item.linkage?.status === 'vinculado' ? 'Confirmado' : 'Pendente'}</td></tr>)}</tbody></table></div>
        <div className="row"><ActionButton icon={<CheckCircle2 size={16} />} disabled={!editable || imported || !preview.result.items.length || duplicates === preview.result.items.length} onClick={() => { try { const outcome = applyBudgetImport({ ...state, budgetItems: [...state.budgetItems] }, preview.result!.items); onImport(preview.result!.items, preview.result!.lists); setImported(true); setError(''); toast(`${outcome.added} itens importados; ${outcome.skipped} já existentes preservados.`, 'ok'); } catch (reason) { setError(String(reason)); toast('Importação não aplicada. Confira a mensagem.', 'err'); } }}>{imported ? 'Lote processado' : 'Confirmar importação'}</ActionButton></div>
      </>}
    </>}
  </div>;
}
