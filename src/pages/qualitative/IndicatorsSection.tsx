import { useState } from 'react';
import { useApp } from '../../store/AppStore';
import { Card, ActionButton, FormField } from '../../components/ui';
import { ImportedReference, SituationBadge } from '../../components/PlanningFields';
import { CatalogField, OfficialFlag } from '../../components/ProposalForm';
import { indicatorsFor, mapComponents, associationValue, stableLocalId, normalizedFlag } from '../../services/planningDomain';
import type { PlanningIndicator } from '../../types';
import { HelpTip } from '../../components/HelpTip';
import { canEditRecord, indicatorPending } from '../../services/editingPolicy';
import { editIndicator } from '../../services/proposalEditing';
import { PendingFields } from '../../components/ProposalForm';
import { RecordOperations } from '../../components/RecordOperations';

const INDICATOR_FIELDS = ['Indicador', 'Código do Programa', 'Nome do Programa', 'Unidade de Medida', 'Fórmula de Cálculo', 'Fonte', 'Periodicidade', 'Base Geográfica', 'Polaridade', 'Índice de Referência', 'Data de Apuração', 'Em apuração? (Índice de Referência)', 'Justificativa do Status em apuração do Índice de Referência', 'Indicador Novo?', 'Exclusão Lógica do Indicador', 'Exclusão Lógica do Programa', 'Data Alteração'];
export function IndicatorsSection({ programId }: { programId: string }) {
  const { state, reference, update, can } = useApp();
  const [selected, setSelected] = useState('');
  const records = indicatorsFor(state, reference, programId);
  const indicator = records.find((record) => record.id === selected);
  const program = state.programs.find((record) => record.id === programId)!;
  const editable = indicator ? canEditRecord(state, 'indicator', indicator) : canEditRecord(state, 'program', program);
  const inProgress = normalizedFlag(indicator?.fields['Em apuração? (Índice de Referência)']) === true;
  const baseline = reference.indicators.find((record) => record.id === indicator?.id);
  const components = mapComponents(state.maps.find((map) => map.programId === programId));
  const change = (apply: (record: PlanningIndicator) => void) => {
    if (!indicator) return;
    update((draft) => {
      if (indicator.origin === 'PPO') { const target = draft.planning!.indicatorProposals[indicator.id] ||= structuredClone(indicator); apply(target); }
      else apply(draft.planning!.localIndicators.find((record) => record.id === indicator.id)!);
    });
  };
  const setFields = (fields: Record<string, string>) => indicator && update((draft) => editIndicator(draft, reference, indicator.id, fields));
  const add = () => {
    const program = state.programs.find((record) => record.id === programId)!;
    const id = stableLocalId('indicador-local');
    update((draft) => draft.planning!.localIndicators.push({ id, programId, origin: 'local', component: null, fields: Object.fromEntries(INDICATOR_FIELDS.map((field) => [field, field === 'Código do Programa' ? program.codigo : field === 'Nome do Programa' ? program.nome : ''])) }));
    setSelected(id);
  };
  return <Card title="Cadastro de indicadores" count={records.length} actions={<ActionButton disabled={!editable} onClick={add}>Adicionar indicador complementar</ActionButton>} lead="Índice de referência e data de apuração preservados. Metas e previsões futuras não integram a proposta.">
    <div className="table-wrap"><table className="dt"><thead><tr><th>Código</th><th>Descrição do Indicador</th><th>Unidade de Medida</th><th>Índice de Referência</th><th>Data de Apuração</th><th>Origem / situação</th><th>Ações</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{record.fields['Código do Indicador'] || 'Sem código oficial'}</td><td>{record.fields.Indicador || 'Indicador em rascunho'}</td><td>{record.fields['Unidade de Medida'] || 'Não informada'}</td><td>{normalizedFlag(record.fields['Em apuração? (Índice de Referência)']) === true ? 'Em apuração' : record.fields['Índice de Referência'] || 'Não informado'}</td><td>{record.fields['Data de Apuração'] || 'Não informada'}</td><td><span className={`badge ${record.origin === 'PPO' ? 'blue' : 'purple'}`}>{record.origin === 'PPO' ? 'Importado PPO' : 'Gerencial local'}</span><SituationBadge value={record.fields['Exclusão Lógica do Indicador']} /></td><td><ActionButton sm color="ghost" onClick={() => setSelected(record.id)}>Consultar e editar indicador</ActionButton></td></tr>)}</tbody></table></div>
    {!records.length && <div className="empty">Nenhum indicador oficial vinculado a este programa.<HelpTip label="Ajuda: indicadores complementares" text="Você pode acrescentar indicadores gerenciais locais. O vínculo com o MaPR é opcional e pode ser definido depois." /></div>}
    {indicator && <fieldset className="sheet-inline-editor indicator-editor"><legend>{indicator.origin === 'PPO' ? 'Proposta de alteração do indicador PPO' : 'Indicador gerencial complementar local'}</legend>
      <div className="row"><PendingFields fields={indicatorPending(indicator)} /><RecordOperations kind="indicator" record={indicator} editable={editable} /></div>
      <FormField label="Código do Indicador" value={indicator.fields['Código do Indicador'] || ''} disabled={!editable || indicator.origin === 'PPO'} onChange={(value) => setFields({ 'Código do Indicador': value })} />
      <FormField label="Indicador" textarea value={indicator.fields.Indicador || ''} disabled={!editable} onChange={(value) => setFields({ Indicador: value })} />
      <div className="grid g2">{['Unidade de Medida', 'Periodicidade', 'Base Geográfica', 'Polaridade'].map((name) => <CatalogField key={name} label={name} names={[name]} fields={indicator.fields} disabled={!editable} onChange={setFields} />)}</div>
      <div className="grid g2">{['Fórmula de Cálculo', 'Fonte'].map((name) => <FormField key={name} label={name} textarea value={indicator.fields[name] || ''} disabled={!editable} onChange={(value) => setFields({ [name]: value })} />)}</div>
      <h3>Índice de referência e situação cadastral</h3>
      <div className="grid g3"><FormField label="Índice de Referência" value={inProgress ? '' : indicator.fields['Índice de Referência'] || ''} disabled={!editable || inProgress} hint="Número decimal (ponto ou vírgula), ou marque Em apuração. Ausência não é zero." onChange={(value) => setFields({ 'Índice de Referência': value })} /><FormField label="Data de Apuração" value={indicator.fields['Data de Apuração'] || ''} disabled={!editable} onChange={(value) => setFields({ 'Data de Apuração': value })} /><OfficialFlag name="Em apuração? (Índice de Referência)" value={indicator.fields['Em apuração? (Índice de Referência)']} disabled={!editable} onChange={(value) => setFields({ 'Em apuração? (Índice de Referência)': value })} /></div>
      <FormField label="Justificativa do Status em apuração do Índice de Referência" textarea value={indicator.fields['Justificativa do Status em apuração do Índice de Referência'] || ''} disabled={!editable} hint={inProgress ? 'Mínimo de 60 caracteres — observada em tela, p. 38. Não impede salvar incompleto.' : undefined} onChange={(value) => setFields({ 'Justificativa do Status em apuração do Índice de Referência': value })} />
      <details className="reference-panel"><summary>Informações cadastrais de referência</summary><div className="grid g3"><FormField label="Data Alteração" value={indicator.fields['Data Alteração'] || ''} disabled onChange={() => {}} /><OfficialFlag name="Indicador Novo?" value={indicator.fields['Indicador Novo?']} disabled onChange={() => {}} /><OfficialFlag name="Exclusão Lógica do Indicador" value={indicator.fields['Exclusão Lógica do Indicador']} disabled onChange={() => {}} /></div></details>
      <h3>Componente acompanhado no MaPR</h3>
      <div className="field"><div className="field-label-row"><label>Componente acompanhado</label><HelpTip label="Ajuda: associação ao MaPR" text="Selecione explicitamente um componente. Nenhuma categoria é atribuída automaticamente; o cadastro funciona antes do mapa." /></div><select aria-label="Componente acompanhado no MaPR" value={associationValue(indicator.component)} disabled={!editable} onChange={(event) => change((record) => { record.component = components.find((component) => component.value === event.target.value)?.association || null; })}>
        <option value="">Sem associação — pode ser definida posteriormente</option>
        {indicator.component && !components.some((component) => component.value === associationValue(indicator.component)) && <option value={associationValue(indicator.component)}>Componente não encontrado — revise a associação</option>}
        {components.map((component) => <option key={component.value} value={component.value}>{component.label}</option>)}
      </select></div>
      <ImportedReference fields={baseline?.fields} proposal={indicator.fields} />
      <ActionButton color="ghost" onClick={() => setSelected('')}>Concluir indicador</ActionButton>
    </fieldset>}
  </Card>;
}
