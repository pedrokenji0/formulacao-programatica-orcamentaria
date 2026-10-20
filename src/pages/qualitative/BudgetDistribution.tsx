import { ActionButton } from '../../components/ui';
import { budgetComparison, formatBudget, planningBudgetSeries } from '../../services/planningTerritoryReference';

const percent = (value: number | null) => value === null ? 'Sem percentual' : value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';

export function BudgetDistribution({ period, selectedId, onSelect }: { period: string; selectedId: string; onSelect: (id: string) => void }) {
  const comparison = budgetComparison(period);
  const selected = planningBudgetSeries.find((record) => record.id === selectedId);
  const years = [...new Set(planningBudgetSeries.map((record) => record.period))].sort();
  return <section className="budget-comparison" aria-label="Comparação dos recursos das duas ações">
    <header><div><span className="planning-eyebrow">Recursos previstos · {period}</span><h3>Distribuição entre as ações do Reurb</h3></div><label className="field">Ano dos recursos<select aria-label="Ano dos recursos" value={period} onChange={(event) => { const next = planningBudgetSeries.find((record) => record.period === event.target.value && record.reference?.actionCode === selected?.reference?.actionCode); if (next) onSelect(next.id); }}>{years.map((year) => <option key={year}>{year}</option>)}</select></label><div className="budget-comparison-total"><small>{comparison.complete ? 'Total das duas ações' : 'Total conhecido · base incompleta'}</small><strong>{formatBudget(comparison.total)}</strong></div></header>
    <div className="budget-action-cards">{comparison.actions.map(({ series, total, share }) => <article key={series.id} className={series.id === selectedId ? 'selected' : ''}>
      <span>Ação {series.reference!.actionCode} · UO {series.ownerUnit}</span><h4>{series.reference!.actionCode === '1082' ? 'Minas Reurb SEDE' : 'Minas Reurb ARMVA'}</h4><strong>{formatBudget(total)}</strong>
      <div className="budget-share-bar" aria-hidden="true"><i style={{ width: (share ?? 0) + '%' }} /></div><p>{percent(share)} do total das duas ações em {period}</p>
      <ActionButton sm color={series.id === selectedId ? 'blue' : 'ghost'} onClick={() => onSelect(series.id)}>{series.id === selectedId ? 'Exibindo ação ' : 'Ver recursos da ação '}{series.reference!.actionCode}</ActionButton>
    </article>)}</div>
    <p className="small muted">Previsão orçamentária do planejamento, em reais nominais. Os valores representam recursos previstos para cada ano. Consulte as parcelas estaduais, regionais e municipais abaixo.</p>
  </section>;
}
