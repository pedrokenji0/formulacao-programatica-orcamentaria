import { useState } from 'react';
import { useApp } from '../../store/AppStore';
import { ActionButton, FormField, Modal } from '../../components/ui';
import { createLocalProjectMap } from '../../services/projectMapDomain';
import { formatUnitCode } from '../../services/budgetUnits';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function ProjectMapCreator({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { state, update } = useApp();
  const program = state.programs.find((record) => record.id === state.currentProgramId)!;
  const [type, setType] = useState<'demais' | 'programa'>('demais');
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [actionIds, setActionIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const generalExists = state.projectMaps?.some((map) => map.projectType === 'programa' && map.ownerProgramId === program.id);
  const matching = state.actions.filter((action) => !query ? action.programaId === program.id : normalize([action.codigo, action.nome, action.codigoUnidadeOrcamentaria, action.unidadeOrcamentaria, action.programaId].join(' ')).includes(normalize(query)));
  const visible = matching.slice(0, 40);
  const create = () => {
    try {
      const map = createLocalProjectMap(state, { name: type === 'programa' ? program.nome : name, ownerProgramId: program.id, actionIds, type });
      update((draft) => { draft.projectMaps ||= []; draft.projectMaps.push(map); });
      onCreated(map.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  return <Modal wide title="Criar mapa do zero" sub="Um único conjunto de MaPR e indicadores, compartilhado pelas ações participantes." onClose={onClose} foot={<><ActionButton color="ghost" onClick={onClose}>Cancelar</ActionButton><ActionButton disabled={type === 'demais' && !name.trim()} onClick={create}>Criar mapas vazios</ActionButton></>}>
    <div className="project-record-editor">
      <section className="sheet-section"><h2>Identificação</h2>
        <label className="field">Abrangência do mapa<select aria-label="Abrangência do mapa" value={type} onChange={(event) => setType(event.target.value as 'demais' | 'programa')}><option value="demais">Demais projetos/processos</option><option value="programa" disabled={generalExists}>Mapa geral do programa{generalExists ? ' — já cadastrado' : ''}</option></select></label>
        {type === 'demais' ? <FormField label="Nome do projeto ou processo" value={name} onChange={setName} /> : <p>{program.codigo} — {program.nome}</p>}
        <p className="small muted">Programa responsável: {program.codigo} — {program.nome}. O cadastro começa vazio, sem copiar o conteúdo do Reurb.</p>
      </section>
      <section className="sheet-section"><h2>Ações participantes</h2><p className="small muted">Opcional. Selecione ações deste programa ou pesquise ações de outros programas e UOs. Todos os participantes acessarão o mesmo mapa.</p>
        <FormField label="Pesquisar ações participantes" value={query} onChange={setQuery} />
        <p role="status">{actionIds.length} ações selecionadas · {matching.length} encontradas</p>
        {actionIds.filter((id) => !visible.some((action) => action.id === id)).map((id) => { const action = state.actions.find((record) => record.id === id)!; return <label className="project-map-check" key={id}><input type="checkbox" checked onChange={() => setActionIds(actionIds.filter((candidate) => candidate !== id))} /><span>Ação {action.codigo} · UO {formatUnitCode(action.codigoUnidadeOrcamentaria)}<small>{action.nome}</small></span></label>; })}
        {visible.map((action) => <label className="project-map-check" key={action.id}><input type="checkbox" checked={actionIds.includes(action.id)} onChange={(event) => setActionIds(event.target.checked ? [...actionIds, action.id] : actionIds.filter((id) => id !== action.id))} /><span><strong>Ação {action.codigo} · UO {formatUnitCode(action.codigoUnidadeOrcamentaria)}</strong><small>{action.nome}</small></span></label>)}
        {matching.length > visible.length && <p className="small muted">Mostrando as primeiras {visible.length}. Refine a pesquisa para encontrar outras ações.</p>}
      </section>
      {error && <p className="alert warn" role="alert">{error}</p>}
    </div>
  </Modal>;
}
