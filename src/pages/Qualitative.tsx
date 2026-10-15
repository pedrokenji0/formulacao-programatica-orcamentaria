import { Tabs, ActionButton } from '../components/ui';
import { CompactHelpContext, HelpTip } from '../components/HelpTip';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { ProgramArea } from './qualitative/ProgramArea';
import { ActionsArea } from './qualitative/ActionsArea';
import { PlanningReview } from './qualitative/PlanningReview';
import { MapaProcessosPage } from './MapaProcessos';
import { draftProgram } from '../services/proposalDomain';
import { canDraftRecord } from '../services/editingPolicy';

const AREAS = [
  { id: 'qual-programa', label: 'Programa' },
  { id: 'qual-acoes', label: 'Ações e Entregas' },
  { id: 'qual-mapa', label: 'Mapa de Processos e Resultados' },
  { id: 'qual-revisao', label: 'Revisão do Planejamento' },
];
export function QualitativePage({ area, onNavigate }: { area: string; onNavigate: (route: string) => void }) {
  const { state, reference, persistenceMessage, update, can, setCurrentProgram } = useApp();
  const program = state.programs.find((record) => record.id === state.currentProgramId);
  const saveError = persistenceMessage.startsWith('Não');
  return <CompactHelpContext.Provider value><div className="qualitative-workspace compact-workspace">
    <h1 className="visually-hidden">Programação Qualitativa</h1>
    <header className="qualitative-header">
      <ActionButton sm color="ghost" aria-label="Visão geral do macroprocesso" title="Visão geral do macroprocesso" onClick={() => onNavigate('fpo')}><ArrowLeft size={15} /></ActionButton>
      <label className="active-program">Programa<select aria-label="Programa ativo" value={state.currentProgramId} onChange={(event) => setCurrentProgram(event.target.value)}>{state.programs.map((record) => <option key={record.id} value={record.id}>{record.codigo || 'Sem código oficial'} — {record.nome || 'Programa em rascunho'}{record.source?.origin === 'local' ? ' · Rascunho' : ''}</option>)}</select></label>
      <HelpTip label="Exercício de referência" text={`Exercício ${reference.manifest.exercise}. ${reference.manifest.exerciseSource}`}><span className="header-exercise">{reference.manifest.exercise}</span></HelpTip>
      <span className={`compact-save${saveError ? ' error' : ''}`} role="status" title={persistenceMessage} aria-label={persistenceMessage || 'Carregando proposta'}>{saveError ? <AlertCircle size={13} /> : <Check size={13} />}{saveError ? 'Erro ao salvar' : persistenceMessage ? 'Salvo' : '…'}</span>
      <ActionButton sm disabled={!canDraftRecord(state)} onClick={() => { update((draft) => draftProgram(draft)); onNavigate('qual-programa'); }}>Rascunhar programa</ActionButton>
    </header>
    {saveError && <div className="alert err" role="alert">{persistenceMessage}</div>}
    <Tabs tabs={AREAS} active={area} onChange={onNavigate} />
    {!program ? <div className="empty">Selecione um programa cadastrado.</div> : <div key={program.id}>
      {area === 'qual-programa' && <ProgramArea program={program} />}
      {area === 'qual-acoes' && <ActionsArea program={program} />}
      {area === 'qual-mapa' && <MapaProcessosPage qualitative />}
      {area === 'qual-revisao' && <PlanningReview program={program} />}
    </div>}
  </div></CompactHelpContext.Provider>;
}
