import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AppState, Perfil, Status, PlanningDataset } from '../types';
import { initialState } from '../data/mockData';
import { mockApi } from '../services/mockApi';
import { createPlanningInitial } from '../services/planningDomain';
import { migrateLegacy } from '../services/planningPersistence';
import { enforceEditingUpdate } from '../services/proposalEditing';
import { canEditRecord } from '../services/editingPolicy';

interface Ctx {
  reference: PlanningDataset;
  persistenceMessage: string;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  update: (fn: (s: AppState) => void) => void;
  setPerfil: (p: Perfil) => void;
  setUnidade: (u: string) => void;
  setCurrentProgram: (id: string) => void;
  can: (action: Permission) => boolean;
  exportState: () => string;
  importState: (json: string) => boolean;
  reset: () => void;
  saveNow: () => Promise<void>;
}

export type Permission =
  | 'editMarcoLogico' | 'editMapa' | 'editObz' | 'editLinks'
  | 'saveRascunho' | 'enviarValidacao' | 'validarOrgao' | 'validarDcmefo'
  | 'devolver' | 'bloquear' | 'adminTabelas' | 'exportar';

export const PERMS: Record<Perfil, Permission[]> = {
  Leitor: ['exportar'],
  'Gestor UA': ['editMarcoLogico', 'editMapa', 'editObz', 'editLinks', 'saveRascunho', 'exportar'],
  'Gestor Setorial': ['editMarcoLogico', 'editMapa', 'editObz', 'editLinks', 'saveRascunho', 'exportar'],
  'Central Geral': ['editMarcoLogico', 'editMapa', 'editObz', 'editLinks', 'saveRascunho', 'adminTabelas', 'exportar'],
  Consulta: ['exportar'],
  'Técnico do Órgão': ['editMarcoLogico', 'editMapa', 'editObz', 'editLinks', 'saveRascunho', 'enviarValidacao', 'exportar'],
  'Validador do Órgão': ['validarOrgao', 'devolver', 'exportar', 'editMarcoLogico', 'editMapa', 'editObz'],
  'DCMEFO/SEPLAG': ['validarDcmefo', 'devolver', 'bloquear', 'exportar'],
  Administrador: ['editMarcoLogico', 'editMapa', 'editObz', 'editLinks', 'saveRascunho', 'enviarValidacao', 'validarOrgao', 'validarDcmefo', 'devolver', 'bloquear', 'adminTabelas', 'exportar'],
};

const AppContext = createContext<Ctx | null>(null);
function freezeReference(value: object) {
  Object.freeze(value);
  for (const item of Object.values(value)) if (item && typeof item === 'object' && !Object.isFrozen(item)) freezeReference(item);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [reference, setReference] = useState<PlanningDataset | null>(null);
  const [loadError, setLoadError] = useState('');
  const [persistenceMessage, setPersistenceMessage] = useState('');
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/planning.json.gz`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(`Base qualitativa indisponível (${response.status}). Execute npm run generate:data.`);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(buffer));
      if (typeof DecompressionStream === 'undefined') throw new Error('Use uma versão atual do Edge, Chrome ou Firefox para abrir a base qualitativa compactada.');
      return new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
    }).then(async (data: PlanningDataset) => {
      if (!active) return;
      mockApi.configure(createPlanningInitial(initialState, data));
      const loaded = await mockApi.loadState();
      if (active) { freezeReference(data); setReference(data); setState(loaded); }
    }).catch((error) => { if (active) setLoadError(String(error)); });
    return () => { active = false; controller.abort(); };
  }, []);

  // persiste a cada mudança
  useEffect(() => {
    if (state) mockApi.saveState(state).then(() => setPersistenceMessage('Proposta salva neste navegador.')).catch((error) => setPersistenceMessage(`Não foi possível salvar a proposta: ${String(error)}. Exporte um pacote para preservar suas alterações.`));
  }, [state]);

  const update = (fn: (s: AppState) => void) =>
    setState((prev) => {
      if (!prev || !reference) return prev;
      const next = structuredClone(prev);
      try { fn(next); enforceEditingUpdate(prev, next, reference); return next; }
      catch (error) { queueMicrotask(() => setPersistenceMessage(`Não foi possível aplicar a alteração: ${String(error)}`)); return prev; }
    });

  const value = useMemo<Ctx | null>(() => state && reference ? ({
    state, reference, persistenceMessage, setState: setState as React.Dispatch<React.SetStateAction<AppState>>, update,
    saveNow: async () => { try { await mockApi.saveState(state); setPersistenceMessage('Proposta salva neste navegador.'); } catch (error) { setPersistenceMessage(`Não foi possível salvar a proposta: ${String(error)}. Exporte um pacote para preservar suas alterações.`); throw error; } },
    setPerfil: (p) => update((s) => { s.perfil = p; }),
    setUnidade: (u) => update((s) => { s.unidade = u; }),
    setCurrentProgram: (id) => update((s) => { s.currentProgramId = id; }),
    can: (action) => PERMS[state.perfil].includes(action) && (!['editMarcoLogico', 'editMapa', 'saveRascunho'].includes(action) || canEditRecord(state, 'program', state.programs.find((program) => program.id === state.currentProgramId)!)),
    exportState: () => JSON.stringify(state, null, 2),
    importState: (json) => {
      if (['Consulta', 'Leitor'].includes(state.perfil)) return false;
      try {
        const parsed = JSON.parse(json);
        if (!parsed || !Array.isArray(parsed.programs) || !Array.isArray(parsed.actions) || !Array.isArray(parsed.budgetItems) || !Array.isArray(parsed.maps) || !Array.isArray(parsed.frameworks) || !Array.isArray(parsed.links) || !Array.isArray(parsed.mirrors) || !parsed.support || !parsed.lists) return false;
        const fresh = createPlanningInitial(initialState, reference);
        if (parsed.schemaVersion === 2 && parsed.planning) {
          if (parsed.planning.datasetId !== reference.manifest.datasetId) parsed.planning.migrationNotices = [...(parsed.planning.migrationNotices || []), 'Pacote de outra versão da base. Confira a comparação com a referência atual.'];
          setState({ ...fresh, ...parsed, planning: { ...fresh.planning, ...parsed.planning } });
        } else setState(migrateLegacy(parsed, fresh, initialState));
        return true;
      } catch { return false; }
    },
    reset: () => { if (!['Consulta', 'Leitor'].includes(state.perfil)) setState(mockApi.resetState()); },
  }) : null, [state, reference, persistenceMessage]);

  if (loadError) return <div className="card"><h1>Não foi possível carregar o planejamento</h1><p>{loadError}</p><button onClick={() => location.reload()}>Tentar novamente</button></div>;
  if (!value) return <div className="card" role="status">Carregando os cadastros qualitativos do PPO…</div>;

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error('useApp deve ser usado dentro de AppProvider');
  return c;
}

// utilidades de status
export const STATUS_COLOR: Record<Status, string> = {
  'NÃO INICIADO': 'gray', RASCUNHO: 'gray', 'EM PREENCHIMENTO': 'blue',
  'ENVIADO PARA VALIDAÇÃO': 'orange', 'VALIDADO PELO ÓRGÃO': 'green',
  'DEVOLVIDO PARA AJUSTES': 'red', 'VALIDADO DCMEFO/SEPLAG': 'green', BLOQUEADO: 'gray',
};
