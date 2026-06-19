import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AppState, Perfil, Status } from '../types';
import { initialState } from '../data/mockData';
import { mockApi } from '../services/mockApi';

interface Ctx {
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
}

export type Permission =
  | 'editMarcoLogico' | 'editMapa' | 'editObz' | 'editLinks'
  | 'saveRascunho' | 'enviarValidacao' | 'validarOrgao' | 'validarDcmefo'
  | 'devolver' | 'bloquear' | 'adminTabelas' | 'exportar';

const PERMS: Record<Perfil, Permission[]> = {
  Consulta: ['exportar'],
  'Técnico do Órgão': ['editMarcoLogico', 'editMapa', 'editObz', 'editLinks', 'saveRascunho', 'enviarValidacao', 'exportar'],
  'Validador do Órgão': ['validarOrgao', 'devolver', 'exportar', 'editMarcoLogico', 'editMapa', 'editObz'],
  'DCMEFO/SEPLAG': ['validarDcmefo', 'devolver', 'bloquear', 'exportar'],
  Administrador: ['editMarcoLogico', 'editMapa', 'editObz', 'editLinks', 'saveRascunho', 'enviarValidacao', 'validarOrgao', 'validarDcmefo', 'devolver', 'bloquear', 'adminTabelas', 'exportar'],
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    try {
      const raw = localStorage.getItem('fpo-state-v1');
      if (raw) return JSON.parse(raw) as AppState;
    } catch { /* ignore */ }
    return JSON.parse(JSON.stringify(initialState));
  });

  // persiste a cada mudança
  useEffect(() => { mockApi.saveState(state); }, [state]);

  const update = (fn: (s: AppState) => void) =>
    setState((prev) => { const next = JSON.parse(JSON.stringify(prev)) as AppState; fn(next); return next; });

  const value = useMemo<Ctx>(() => ({
    state, setState, update,
    setPerfil: (p) => update((s) => { s.perfil = p; }),
    setUnidade: (u) => update((s) => { s.unidade = u; }),
    setCurrentProgram: (id) => update((s) => { s.currentProgramId = id; }),
    can: (action) => PERMS[state.perfil].includes(action),
    exportState: () => JSON.stringify(state, null, 2),
    importState: (json) => {
      try { const parsed = JSON.parse(json); setState(parsed); return true; } catch { return false; }
    },
    reset: () => setState(mockApi.resetState()),
  }), [state]);

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
