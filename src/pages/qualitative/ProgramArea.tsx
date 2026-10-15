import { useState } from 'react';
import type { Program, OfficialFields } from '../../types';
import { useApp } from '../../store/AppStore';
import { Card, ActionButton, FormField, Modal, Tabs } from '../../components/ui';
import { ImportedReference, SituationBadge } from '../../components/PlanningFields';
import { CatalogField, SheetIndex, SheetSection, ProposalOrigin, PendingFields } from '../../components/ProposalForm';
import { ProposalActions, RestoreProposal, ExclusionProposal } from '../../components/ProposalActions';
import { applyProgramFields, causeItems, programPending, restoreProgram } from '../../services/proposalDomain';
import { stableLocalId } from '../../services/planningDomain';
import { IndicatorsSection } from './IndicatorsSection';
import { MarcoLogicoPage } from '../MarcoLogico';
import { HelpTip } from '../../components/HelpTip';
import { canEditRecord, editingContext, fieldRule } from '../../services/editingPolicy';
import { changeSituation } from '../../services/proposalEditing';
import { AssociationProposal } from '../../components/AssociationProposal';
import { Trash2 } from 'lucide-react';

const SECTIONS = [
  { id: 'programa-identificacao', label: 'Identificação e responsabilidade' }, { id: 'programa-alinhamento', label: 'Alinhamento estratégico' },
  { id: 'programa-objetivo', label: 'Objetivo e justificativa' }, { id: 'programa-causas', label: 'Causas' }, { id: 'programa-estrategia', label: 'Implementação' },
  { id: 'programa-analise', label: 'Apoio à análise' },
];
export function ProgramArea({ program }: { program: Program }) {
  const { state, reference, update } = useApp();
  const [tool, setTool] = useState('');
  const [tab, setTab] = useState('ficha');
  const [restore, setRestore] = useState(false);
  const [selectedLink, setSelectedLink] = useState<number | null>(null);
  const [newCause, setNewCause] = useState('');
  const fields = program.officialFields || {};
  const editable = canEditRecord(state, 'program', program);
  const context = editingContext(state, 'program', program);
  const locked = (field: string) => !fieldRule('program', field, context).editable;
  const baseline = reference.programs.find((record) => record.id === program.id);
  const links = program.strategicLinks || [];
  const causes = causeItems(program);
  const tools = [{ id: 'arvores', label: 'Árvores de Problemas e Objetivos' }, { id: 'alternativas', label: 'Análise de Alternativas' }, { id: 'envolvidos', label: 'Análise de Envolvidos' }];
  const setFields = (values: OfficialFields) => update((draft) => applyProgramFields(draft, program.id, values, reference));
  const setField = (field: string, value: string) => setFields({ [field]: value });
  const editCauses = (apply: (items: { id: string; texto: string }[]) => void) => update((draft) => {
    const target = draft.programs.find((record) => record.id === program.id)!;
    target.causeItems = structuredClone(causeItems(target)); apply(target.causeItems);
    applyProgramFields(draft, target.id, { Causas: target.causeItems.map((item) => item.texto).join(' / ') });
  });
  const editLink = (values: OfficialFields) => update((draft) => { const target = draft.programs.find((record) => record.id === program.id)!; Object.assign(target.strategicLinks![selectedLink!], values); });
  return <div className="ppo-sheet">
    <Card>
      <div className="sheet-toolbar"><Tabs tabs={[{ id: 'ficha', label: 'Ficha do programa' }, { id: 'indicadores', label: 'Indicadores' }, ...(tab === 'exclusao' ? [{ id: 'exclusao', label: 'Justificativa de exclusão' }] : [])]} active={tab} onChange={setTab} />
      <ProposalActions record={program} position="início" editable={editable} onRestore={baseline ? () => setRestore(true) : undefined} onExclude={baseline ? () => setTab('exclusao') : undefined} metadata={<><ProposalOrigin record={program} baseline={baseline} /><SituationBadge value={fields['Exclusão Lógica do Programa']} /><PendingFields fields={programPending(program)} /></>} /></div>
      {tab === 'ficha' && <>
      <SheetIndex items={SECTIONS} />
      <SheetSection id="programa-identificacao" title="Identificação e responsabilidade">
        <div className="program-id-fields"><FormField label="PPAG" value={baseline?.officialFields?.PPAG || ''} disabled hint="Não informado na exportação. Metadado de referência, sem preenchimento livre." onChange={() => {}} /><FormField label="Código do Programa" value={program.codigo} disabled={locked('Código do Programa')} hint={program.codigo ? undefined : 'Sem código oficial. Não é necessário para salvar.'} onChange={(value) => setField('Código do Programa', value)} /><FormField label="Nome do Programa" value={program.nome} disabled={!editable} onChange={(value) => setField('Nome do Programa', value)} /></div>
        <div className="grid g2"><FormField label="Órgão Responsável pelo Programa" value={[program.codigoOrgao, program.orgao].filter(Boolean).join(' — ')} disabled hint="Relação conhecida no cadastro de UOs; não deduzida pelo código." onChange={() => {}} /><CatalogField label="Unidade Orçamentária Responsável pelo Programa" names={['Código da Unidade Orçamentária Responsável pelo Programa', 'Unidade Orçamentária Responsável pelo Programa']} fields={fields} disabled={locked('Código da Unidade Orçamentária Responsável pelo Programa')} onChange={setFields} /></div>
        <div className="grid g2"><FormField label="Unidade Administrativa Responsável pelo Programa" value={fields['Unidade Administrativa Responsável pelo Programa'] || ''} disabled={!editable} onChange={(value) => setField('Unidade Administrativa Responsável pelo Programa', value)} /><CatalogField label="Área Temática" names={['Código da Área Temática', 'Área Temática']} fields={fields} disabled={!editable} onChange={setFields} /></div>
        {baseline && <AssociationProposal record={program} editable={editable} />}
      </SheetSection>
      <SheetSection id="programa-alinhamento" title="Alinhamento estratégico" help="Cada linha mantém sua combinação de objetivo estratégico, diretriz e ODS. Alterar um vínculo não modifica os demais.">
        <div className="table-wrap strategic-table"><table className="dt"><thead><tr><th>Objetivo Estratégico</th><th>Diretriz Estratégica</th><th>Objetivo de Desenvolvimento Sustentável</th><th>Proposta</th></tr></thead><tbody>{links.map((link, index) => <tr key={index}>
          <td><div className="compact-cell" title={link['Objetivo Estratégico']}>{link['Código do Objetivo Estratégico']} — {link['Objetivo Estratégico'] || 'Não informado'}</div></td>
          <td><div className="compact-cell" title={link['Diretriz Estratégica']}>{link['Código da Diretriz Estratégica']} — {link['Diretriz Estratégica'] || 'Não informado'}</div></td>
          <td>{link['Título do Objetivo de Desenvolvimento Sustentável'] || 'Não informado'}{link['Subtítulo do Objetivo de Desenvolvimento Sustentável'] && <HelpTip label={`Detalhes do ODS — vínculo ${index + 1}`} text={link['Subtítulo do Objetivo de Desenvolvimento Sustentável']} />}</td>
          <td><div className="row"><ActionButton sm color="ghost" onClick={() => setSelectedLink(index)}>{editable ? 'Editar' : 'Consultar'} vínculo {index + 1}</ActionButton><ActionButton sm color="ghost" disabled={!editable} onClick={() => { update((draft) => { draft.programs.find((record) => record.id === program.id)!.strategicLinks!.splice(index, 1); }); setSelectedLink(null); }}>Remover vínculo {index + 1}</ActionButton></div></td>
        </tr>)}</tbody></table></div>
        {!links.length && <p className="small muted">Nenhum vínculo estratégico informado.</p>}
        <ActionButton disabled={!editable} onClick={() => { setSelectedLink(links.length); update((draft) => { const target = draft.programs.find((record) => record.id === program.id)!; target.strategicLinks ||= []; target.strategicLinks.push({}); }); }}>Acrescentar vínculo estratégico</ActionButton>
        {selectedLink !== null && links[selectedLink] && <fieldset className="sheet-inline-editor"><legend>Vínculo estratégico {selectedLink + 1}</legend>
          <CatalogField label="Objetivo Estratégico" names={['Código do Objetivo Estratégico', 'Objetivo Estratégico']} fields={links[selectedLink]} disabled={!editable} onChange={editLink} />
          <CatalogField label="Diretriz Estratégica" names={['Código da Diretriz Estratégica', 'Diretriz Estratégica']} fields={links[selectedLink]} disabled={!editable} onChange={editLink} />
          <CatalogField label="Objetivo de Desenvolvimento Sustentável" names={['Título do Objetivo de Desenvolvimento Sustentável', 'Subtítulo do Objetivo de Desenvolvimento Sustentável']} fields={links[selectedLink]} disabled={!editable} onChange={editLink} />
          <ActionButton sm color="ghost" onClick={() => setSelectedLink(null)}>Concluir vínculo</ActionButton>
        </fieldset>}
      </SheetSection>
      <div className="program-planning-grid">
      <div className="program-narrative">
      <SheetSection id="programa-objetivo" title="Objetivo e justificativa">
        <div className="grid g2"><FormField label="Objetivo do Programa" textarea value={program.objetivo} disabled={!editable} hint="Que situação se pretende alcançar, melhorar ou preservar?" onChange={(value) => setField('Objetivo', value)} />
        <FormField label="Justificativa do Programa" textarea value={program.justificativa} disabled={!editable} hint="Que problema ou necessidade justifica a atuação?" onChange={(value) => setField('Justificativa', value)} /></div>
      </SheetSection>
      <SheetSection id="programa-estrategia" title="Implementação">
        <FormField label="Estratégia de Implementação" textarea value={program.estrategiaImplementacao || ''} disabled={!editable} hint="Como o programa pretende atuar?" onChange={(value) => setField('Estratégia de Implementação', value)} />
        <div className="grid g2"><CatalogField label="Tipo de Programa" names={['Tipo de Programa']} fields={fields} disabled={locked('Tipo de Programa')} onChange={setFields} /><CatalogField label="Horizonte Temporal" names={['Horizonte Temporal']} fields={fields} disabled={!editable} onChange={setFields} /></div>
      </SheetSection>
      </div>
      <SheetSection id="programa-causas" title="Causas" help="Itens editáveis do campo Causas. A divisão do texto é uma organização local; a referência importada permanece íntegra. Não é obrigatório construir uma árvore causal.">
        <div className="cause-grid">{causes.map((cause, index) => <div className="editable-activity" key={cause.id}><FormField label={`Causa ${index + 1}`} textarea value={cause.texto} disabled={!editable} onChange={(value) => editCauses((items) => { items.find((item) => item.id === cause.id)!.texto = value; })} /><ActionButton sm color="ghost" aria-label={`Remover causa ${index + 1}`} title={`Remover causa ${index + 1}`} disabled={!editable} onClick={() => editCauses((items) => { items.splice(index, 1); })}><Trash2 size={16} /></ActionButton></div>)}</div>
        {!causes.length && <p className="small muted">Nenhuma causa informada.</p>}
        <div className="row add-cause"><FormField label="Nova causa" textarea value={newCause} disabled={!editable} onChange={setNewCause} /><ActionButton disabled={!editable || !newCause.trim()} onClick={() => { editCauses((items) => items.push({ id: stableLocalId('causa-local'), texto: newCause.trim() })); setNewCause(''); }}>Adicionar causa</ActionButton></div>
        <details className="reference-panel"><summary>Causas — texto original da base</summary><p className="preserve-text">{baseline?.officialFields?.Causas || 'Sem conteúdo importado.'}</p></details>
      </SheetSection>
      </div>
      <details className="reference-panel"><summary>Informações do gerente</summary><div className="grid g2">{['Nome do Gerente', 'E-mail do Gerente', 'Telefone do Gerente', 'Cargo do Gerente'].map((name) => <FormField key={name} label={name} value={fields[name] ?? program.ppoComplements?.[name] ?? program.ppoComplements?.[name.replace(' do Gerente', '')] ?? ''} disabled={locked(name)} hint={baseline?.officialFields?.[name] === undefined ? 'Campo não fornecido pela exportação; complemento local.' : undefined} onChange={(value) => setField(name, value)} />)}</div></details>
      <SheetSection id="programa-analise" title="Apoio à análise" help="Ferramentas opcionais. A ficha e o MaPR funcionam sem realizar estas análises."><div className="row">{tools.map((record) => <ActionButton key={record.id} color="ghost" onClick={() => setTool(record.id)}>{record.label}</ActionButton>)}</div></SheetSection>
      <ImportedReference fields={baseline?.officialFields} proposal={fields} />
      </>}
      {tab === 'indicadores' && <IndicatorsSection programId={program.id} />}
      {tab === 'exclusao' && baseline && <ExclusionProposal record={program} editable={editable} onChange={(value) => setField('Justificativa de Inclusão ou Exclusão do Programa', value)} onConfirm={() => update((draft) => changeSituation(draft, reference, 'program', program.id, true, fields['Justificativa de Inclusão ou Exclusão do Programa']))} />}
      <ProposalActions record={program} position="final" editable={editable} onRestore={baseline ? () => setRestore(true) : undefined} onExclude={baseline ? () => setTab('exclusao') : undefined} />
    </Card>
    {tool && <Modal wide title={tools.find((record) => record.id === tool)!.label} onClose={() => setTool('')}><MarcoLogicoPage initialTab={tool} embedded /></Modal>}
    {restore && <RestoreProposal onClose={() => setRestore(false)} onConfirm={() => { update((draft) => restoreProgram(draft, reference, program.id)); setRestore(false); setSelectedLink(null); setTab('ficha'); }} />}
  </div>;
}
