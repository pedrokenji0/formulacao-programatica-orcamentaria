import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { ActionButton, useToast } from './ui';
import type { BudgetItemOBZ, SelectionLists } from '../types';

// campos lógicos -> variações aceitas de cabeçalho
const FIELD_ALIASES: Record<string, string[]> = {
  unidadeOrcamentaria: ['UNIDADE ORÇAMENTÁRIA', 'UNIDADE ORCAMENTARIA', 'UO'],
  programa: ['PROGRAMA'],
  acao: ['AÇÃO', 'ACAO'],
  grupo: ['GRUPO'],
  elementoItem: ['ELEMENTO ITEM', 'ELEMENTO-ITEM', 'ELEMENTO_ITEM'],
  agrupamento: ['AGRUPAMENTO'],
  fonte: ['FONTE'],
  descricao: ['DESCRIÇÃO DO ITEM', 'DESCRICAO DO ITEM'],
  premissaVolume: ['PREMISSA VOLUME'],
  volume: ['VOLUME'],
  premissaPreco: ['PREMISSA DE PREÇO', 'PREMISSA DE PRECO'],
  precoUnitario: ['PREÇO UNITÁRIO', 'PRECO UNITARIO'],
  frequencia: ['FREQUÊNCIA PAGAMENTO', 'FREQUENCIA PAGAMENTO', 'FREQUÊNCIA'],
  valorTotal: ['VALOR TOTAL ITEM'],
  classificacao: ['CLASSIFICAÇÃO CENÁRIO', 'CLASSIFICACAO CENARIO'],
  novo: ['NOVO?', 'NOVO'],
  descricaoCenario: ['DESCRIÇÃO DO CENÁRIO', 'DESCRICAO DO CENARIO'],
  risco: ['RISCO DE NÃO FAZER', 'RISCO DE NAO FAZER'],
  beneficio: ['BENEFICIO AO FAZER', 'BENEFÍCIO AO FAZER'],
  pN3: ['PRIORIDADE N3'], pN2: ['PRIORIDADE N2'], pN1: ['PRIORIDADE N1'],
};
const REQUIRED = ['acao', 'descricao'];
const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const codeOf = (s: string) => (String(s).match(/^\s*([\w.]+)/)?.[1] || String(s)).trim();

export function ImportWizard({ onImport }: { onImport: (items: BudgetItemOBZ[], lists: Partial<SelectionLists>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [rows, setRows] = useState<any[][]>([]);
  const [headerIdx, setHeaderIdx] = useState(-1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [sheetName, setSheetName] = useState('');

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'array' });
        const order = ['BASE OBZ', 'BASE OBZ - EXEMPLO', ...wb.SheetNames].filter((v, i, a) => a.indexOf(v) === i && wb.SheetNames.includes(v));
        let chosen = ''; let r: any[][] = []; let hi = -1;
        for (const sn of order) {
          const data = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sn], { header: 1, defval: '' });
          const h = findHeader(data);
          if (h >= 0) { chosen = sn; r = data; hi = h; break; }
        }
        if (hi < 0) { chosen = wb.SheetNames[0]; r = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[chosen], { header: 1, defval: '' }); hi = 0; }
        const hdrs = (r[hi] || []).map((c) => String(c || '').trim());
        const map: Record<string, number> = {};
        for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
          const idx = hdrs.findIndex((h) => aliases.some((a) => h.toUpperCase() === a));
          if (idx >= 0) map[field] = idx;
        }
        setRows(r); setHeaderIdx(hi); setHeaders(hdrs); setMapping(map); setSheetName(chosen);
        toast(`Aba "${chosen}" carregada — confira o mapeamento de colunas.`, 'ok');
      } catch (err) { console.error(err); toast('Falha ao ler a planilha.', 'err'); }
    };
    reader.readAsArrayBuffer(file);
  }

  function findHeader(data: any[][]): number {
    for (let i = 0; i < Math.min(data.length, 15); i++) {
      const up = (data[i] || []).map((c) => String(c || '').toUpperCase());
      if (up.some((c) => c.includes('DESCRIÇÃO DO ITEM') || c.includes('DESCRICAO DO ITEM'))) return i;
    }
    return -1;
  }

  function doImport() {
    if (REQUIRED.some((f) => mapping[f] == null)) { toast('Mapeie ao menos AÇÃO e DESCRIÇÃO DO ITEM.', 'err'); return; }
    const get = (row: any[], f: string) => (mapping[f] != null ? row[mapping[f]] : '');
    const items: BudgetItemOBZ[] = [];
    const L: Partial<SelectionLists> = { programas: [], acoes: [], grupos: [], elementosItens: [], agrupamentos: [], fontes: [], unidades: [] };
    const push = (k: keyof SelectionLists, v: string) => { v = String(v || '').trim(); if (v && !(L[k] as string[]).includes(v)) (L[k] as string[]).push(v); };
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i]; const desc = String(get(row, 'descricao') || '').trim(); const acao = String(get(row, 'acao') || '').trim();
      if (!desc || !acao) continue;
      const programa = String(get(row, 'programa') || '').trim();
      const grupo = String(get(row, 'grupo') || '').trim(); const elem = String(get(row, 'elementoItem') || '').trim();
      const agr = String(get(row, 'agrupamento') || '').trim(); const fonte = String(get(row, 'fonte') || '').trim();
      const uo = String(get(row, 'unidadeOrcamentaria') || '').trim();
      const vol = num(get(row, 'volume')); const preco = num(get(row, 'precoUnitario')); const freq = num(get(row, 'frequencia')) || 1;
      const valor = num(get(row, 'valorTotal')) || vol * preco * freq;
      const classif = String(get(row, 'classificacao') || '').toUpperCase().includes('INCRE') ? 'INCREMENTAL' : 'LIMIAR';
      push('programas', programa); push('acoes', acao); push('grupos', grupo); push('elementosItens', elem);
      push('agrupamentos', agr); push('fontes', fonte); push('unidades', uo);
      items.push({
        id: 'imp-' + i, unidadeOrcamentaria: uo, programaId: 'prog-' + codeOf(programa), actionId: 'act-' + codeOf(acao),
        acaoLabel: acao, grupo, elemento: 'ELEMENTO', elementoItem: elem, agrupamento: agr, fonte,
        descricao: desc, premissaVolume: String(get(row, 'premissaVolume') || ''), volume: vol,
        premissaPreco: String(get(row, 'premissaPreco') || ''), precoUnitario: preco, frequenciaPagamento: freq, valorTotal: valor,
        classificacaoCenario: classif as any, novo: /SIM/i.test(String(get(row, 'novo') || '')),
        descricaoCenario: String(get(row, 'descricaoCenario') || ''), riscoNaoFazer: String(get(row, 'risco') || ''),
        beneficioAoFazer: String(get(row, 'beneficio') || ''), prioridadeN3: num(get(row, 'pN3')), prioridadeN2: num(get(row, 'pN2')),
        prioridadeN1: num(get(row, 'pN1')), observacoes: '', statusValidacao: 'EM PREENCHIMENTO',
      });
    }
    onImport(items, L);
    toast(`Importados ${items.length} itens OBZ.`, 'ok');
  }

  const preview = rows.slice(headerIdx + 1, headerIdx + 6).filter((r) => r.some((c) => String(c).trim()));

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <ActionButton color="purple" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>Selecionar planilha .xlsx</ActionButton>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {sheetName && <span className="badge purple"><FileSpreadsheet size={13} /> aba: {sheetName}</span>}
      </div>

      {headers.length > 0 && (
        <>
          <h3>Mapeamento de colunas</h3>
          <p className="lead">Cabeçalhos reconhecidos automaticamente; ajuste manualmente se necessário.</p>
          <div className="grid g3">
            {Object.keys(FIELD_ALIASES).map((field) => (
              <div className="field" key={field}>
                <label>{field}{REQUIRED.includes(field) && <span className="req"> *</span>}</label>
                <select value={mapping[field] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value === '' ? undefined as any : Number(e.target.value) }))}>
                  <option value="">— não mapear —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `coluna ${i}`}</option>)}
                </select>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 16 }}>Prévia ({preview.length} de {rows.length - headerIdx - 1} linhas)</h3>
          <div className="table-wrap">
            <table className="dt">
              <thead><tr>{['Ação', 'Descrição', 'Grupo', 'Elem.-item', 'Fonte', 'Valor', 'Cenário'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {preview.map((row, i) => {
                  const g = (f: string) => mapping[f] != null ? String(row[mapping[f]] ?? '') : '';
                  return <tr key={i}><td>{g('acao').slice(0, 30)}</td><td>{g('descricao').slice(0, 40)}</td><td>{g('grupo').slice(0, 18)}</td><td>{g('elementoItem').slice(0, 18)}</td><td>{g('fonte')}</td><td>{g('valorTotal')}</td><td>{g('classificacao')}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <ActionButton color="green" icon={<CheckCircle2 size={16} />} onClick={doImport}>Confirmar importação</ActionButton>
          </div>
        </>
      )}
    </div>
  );
}
