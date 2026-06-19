import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export interface Issue { level: 'err' | 'warn' | 'ok'; text: string; }

export function ValidationPanel({ issues, title }: { issues: Issue[]; title?: string }) {
  const errs = issues.filter((i) => i.level === 'err');
  const warns = issues.filter((i) => i.level === 'warn');
  return (
    <div>
      {title && <h3>{title}</h3>}
      {issues.length === 0 && <div className="alert ok"><CheckCircle2 className="ai" size={17} />Nenhuma pendência identificada.</div>}
      {errs.length === 0 && warns.length === 0 && issues.length > 0 && (
        <div className="alert ok"><CheckCircle2 className="ai" size={17} />Tudo certo.</div>
      )}
      {issues.map((i, idx) => (
        <div key={idx} className={'alert ' + i.level}>
          {i.level === 'err' ? <XCircle className="ai" size={17} /> : i.level === 'warn' ? <AlertTriangle className="ai" size={17} /> : <CheckCircle2 className="ai" size={17} />}
          {i.text}
        </div>
      ))}
    </div>
  );
}
