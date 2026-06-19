import type { Status } from '../types';
import { StatusBadge } from './ui';
import { useApp } from '../store/AppStore';

export function PageHeader({ crumb, title, sub, status, showProgram = true, right }: {
  crumb: string; title: string; sub?: string; status?: Status; showProgram?: boolean; right?: React.ReactNode;
}) {
  const { state, setCurrentProgram } = useApp();
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="page-head">
        <div>
          <div className="crumb">{crumb}</div>
          <h1>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
        <div className="row">
          {status && <StatusBadge status={status} />}
          {right}
        </div>
      </div>
      {showProgram && (
        <div className="row" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 12px' }}>
          <span className="small muted" style={{ fontWeight: 700 }}>Programa ativo:</span>
          <select value={state.currentProgramId} onChange={(e) => setCurrentProgram(e.target.value)}
            style={{ flex: 1, minWidth: 240, maxWidth: 620, border: '1px solid #ccd6dc', borderRadius: 8, padding: '7px 10px', fontWeight: 600 }}>
            {state.programs.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.nome} · {p.orgao}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
