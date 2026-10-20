import React, { useState } from 'react';

export interface Column<T> { key: string; header: string; num?: boolean; render?: (row: T) => React.ReactNode; width?: number }
const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
export function DataTable<T extends { id?: string }>({ columns, rows, empty, pageSize = 0, searchLabel, searchText }: {
  columns: Column<T>[]; rows: T[]; empty?: string; pageSize?: number; searchLabel?: string; searchText?: (row: T) => string;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const filtered = query ? rows.filter((row) => searchable(searchText ? searchText(row) : Object.values(row).filter((value) => typeof value === 'string' || typeof value === 'number').join(' ')).includes(searchable(query))) : rows;
  const pages = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = pageSize > 0 ? filtered.slice(current * pageSize, (current + 1) * pageSize) : filtered;
  return <div className="data-table">
    {searchLabel && <label className="field data-table-search">{searchLabel}<input type="search" aria-label={searchLabel} placeholder="Pesquisar…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label>}
    {!filtered.length ? <div className="empty">{rows.length ? 'Nenhum registro corresponde à pesquisa.' : empty || 'Nenhum registro.'}</div> : <div className="table-wrap"><table className="dt"><thead><tr>{columns.map((column) => <th key={column.key} className={column.num ? 'num' : ''} style={column.width ? { width: column.width } : undefined}>{column.header}</th>)}</tr></thead><tbody>{visible.map((row, index) => <tr key={row.id || index}>{columns.map((column) => <td key={column.key} className={column.num ? 'num' : ''}>{column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '')}</td>)}</tr>)}</tbody></table></div>}
    {pageSize > 0 && <div className="row data-table-pagination" aria-label="Paginação da tabela"><span role="status">{filtered.length} registros · página {current + 1} de {pages}</span><button className="btn ghost sm" disabled={!current} onClick={() => setPage(current - 1)}>Anterior</button><button className="btn ghost sm" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Próxima</button></div>}
  </div>;
}
