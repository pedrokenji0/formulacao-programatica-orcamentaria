import { initialState } from '../data/mockData';
import type {
  AppState, Program, Action, LogicalFramework, ProcessMap, BudgetItemOBZ,
  CoherenceLink, ProblemNode, ObjectiveNode,
} from '../types';

const KEY = 'fpo-state-v1';
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

function read(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(initialState));
}
function write(s: AppState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export const mockApi = {
  async loadState(): Promise<AppState> { await delay(); return read(); },
  async saveState(s: AppState): Promise<void> { await delay(0); write(s); },
  resetState(): AppState { const s = JSON.parse(JSON.stringify(initialState)); write(s); return s; },

  async getPrograms(): Promise<Program[]> { await delay(); return read().programs; },
  async getProgram(id: string): Promise<Program | undefined> { await delay(); return read().programs.find((p) => p.id === id); },
  async getActions(programId: string): Promise<Action[]> { await delay(); return read().actions.filter((a) => a.programaId === programId); },
  async getLogicalFramework(programId: string): Promise<LogicalFramework | undefined> { await delay(); return read().frameworks.find((f) => f.programId === programId); },
  async getProcessMap(programId: string): Promise<ProcessMap | undefined> { await delay(); return read().maps.find((m) => m.programId === programId); },
  async getBudgetItems(programId: string): Promise<BudgetItemOBZ[]> { await delay(); return read().budgetItems.filter((b) => b.programaId === programId); },
  async getCoherenceLinks(programId: string): Promise<CoherenceLink[]> {
    await delay();
    const s = read();
    const ids = new Set(s.budgetItems.filter((b) => b.programaId === programId).map((b) => b.id));
    return s.links.filter((l) => ids.has(l.budgetItemId));
  },

  // Transformação automática problemas -> objetivos
  generateObjectiveTree(problemNodes: ProblemNode[]): ObjectiveNode[] {
    const map: Record<string, any> = {
      'problema central': 'objetivo central', 'causa estrutural': 'meio', 'causa maior': 'meio',
      'causa superficial': 'meio', 'consequência direta': 'fim', 'consequência final': 'fim',
      'parâmetro externo': 'parâmetro externo',
    };
    return problemNodes.map((n) => ({
      id: `obj-${n.id}`, text: positivize(n.text), problemNodeId: n.id, type: map[n.type],
      parentId: n.parentId ? `obj-${n.parentId}` : null, isParameter: n.type === 'parâmetro externo', notes: '',
    }));
  },

  calculateCoherenceScore(programId: string): number {
    const s = read();
    const map = s.maps.find((m) => m.programId === programId);
    if (!map) return 0;
    let score = 0, total = 0;
    const add = (ok: boolean) => { total++; if (ok) score++; };
    add(!!map.problemaCentral.trim());
    add(map.contexto.length > 0);
    add(map.resultados.length > 0);
    add(map.impactos.length > 0);
    add(map.actions.length > 0);
    for (const a of map.actions) {
      add(a.recursos.length > 0); add(a.atividades.length > 0); add(a.produtos.length > 0);
    }
    return total ? Math.round((score / total) * 100) : 0;
  },
};

function positivize(t: string): string {
  let s = t;
  const repl: [RegExp, string][] = [
    [/^baixo\b/i, 'Adequado'], [/^baixa\b/i, 'Adequada'], [/^insufici[êe]ncia/i, 'Suficiência'],
    [/^dificuldade/i, 'Facilidade'], [/^desigualdade/i, 'Equidade'], [/^descontinuidade/i, 'Continuidade'],
    [/^manuten[çc][ãa]o de desigualdades/i, 'Redução de desigualdades'], [/^menor\b/i, 'Maior'],
    [/^reduç[ãa]o\b/i, 'Aumento'], [/^custos de/i, 'Viabilização de'], [/^ausência/i, 'Presença'],
  ];
  for (const [re, to] of repl) if (re.test(s)) { s = s.replace(re, to); break; }
  return s;
}
