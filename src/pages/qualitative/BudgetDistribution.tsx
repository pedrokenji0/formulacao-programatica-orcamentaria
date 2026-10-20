import { ActionButton } from '../../components/ui';
import { HelpTip } from '../../components/HelpTip';
import { budgetComparison, formatBudget, planningProjects } from '../../services/planningTerritoryReference';

export function BudgetDistribution({ period, projectCode, selectedId, onSelect }: { period: string; projectCode: string; selectedId: string; onSelect: (id: string) => void }) {
  const comparison = budgetComparison(period, undefined, projectCode);
  const project = planningProjects.find((project) => project.code === projectCode);
  if (comparison.actions.length < 2) return null;
  return <details className="territory-comparison reference-panel">
    <summary>Comparar recursos entre ações do projeto · {period}</summary>
    <section aria-label="Comparação dos recursos do projeto">
      <div className="territory-comparison-heading"><strong>Total {formatBudget(comparison.total)}</strong><HelpTip label="Critério da comparação de recursos" text="Somente ações deste projeto no mesmo ano. Valores previstos no planejamento, em reais nominais. Percentuais exigem valores conhecidos para todas as ações." /></div>
      <div className="table-wrap"><table className="dt"><thead><tr><th>Ação / UO</th><th>Previsão</th><th>Participação</th><th /></tr></thead><tbody>{comparison.actions.map(({ series, total, share }) => {
        const action = project?.actions.find((action) => action.id === series.reference!.actionId);
        return <tr key={series.id}><td><strong>{series.reference!.actionCode} · UO {series.ownerUnit}</strong><small>{action?.name}</small></td><td>{formatBudget(total)}</td><td>{share === null ? '—' : share.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%'}</td><td><ActionButton sm color={series.id === selectedId ? 'blue' : 'ghost'} onClick={() => onSelect(series.id)}>{series.id === selectedId ? 'Selecionada' : 'Ver ação ' + series.reference!.actionCode}</ActionButton></td></tr>;
      })}</tbody></table></div>
    </section>
  </details>;
}
