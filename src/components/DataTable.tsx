import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  num?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: number;
}

export function DataTable<T extends { id?: string }>({ columns, rows, empty }: {
  columns: Column<T>[]; rows: T[]; empty?: string;
}) {
  if (!rows.length) return <div className="empty">{empty || 'Nenhum registro.'}</div>;
  return (
    <div className="table-wrap">
      <table className="dt">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.num ? 'num' : ''} style={c.width ? { width: c.width } : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={(r.id as string) || i}>
              {columns.map((c) => (
                <td key={c.key} className={c.num ? 'num' : ''}>
                  {c.render ? c.render(r) : String((r as any)[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
