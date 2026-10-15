import type { Action, Program } from './index';

export type OfficialFields = Record<string, string>;
export type MapComponentKind = 'recurso' | 'atividade' | 'produto' | 'resultado' | 'impacto';
export interface ComponentAssociation {
  kind: MapComponentKind;
  componentId: string;
  actionId?: string;
}
export interface PlanningIndicator {
  id: string;
  programId: string;
  origin: 'PPO' | 'local';
  fields: OfficialFields;
  component: ComponentAssociation | null;
}
export interface TerritorialRelation {
  id: string;
  fields: OfficialFields;
  statusFields: OfficialFields;
}
export interface PlanningLocalizer {
  id: string;
  origin?: 'PPO' | 'local';
  actionId: string | null;
  expectedActionId: string;
  programId: string;
  fields: OfficialFields;
  territories: TerritorialRelation[];
  exclusionProposal?: boolean;
}
export interface ActionComplements {
  etapasImplementacao?: { id: string; titulo: string; descricao: string; responsaveis: string; condicoes: string; evidencias: string }[];
  atividades: { id: string; texto: string }[];
  criterioEntrega: string;
  evidenciaEntrega: string;
  parceirosCondicoes: string;
  distribuicaoTerritorial: string;
  papelLocalizador: string;
  criteriosTerritoriais: string;
  condicoesTerritoriais: string;
}
export interface ImportIssue {
  id: string;
  kind: string;
  recordId: string;
  message: string;
}
export interface PlanningDataset {
  manifest: {
    schemaVersion: number;
    exercise: string;
    exerciseSource: string;
    datasetId: string;
    encoding: string;
    delimiter: string;
    sources: Record<string, { rows: number; headers: string[]; sha256: string }>;
  };
  programs: Program[];
  actions: Action[];
  indicators: PlanningIndicator[];
  localizers: PlanningLocalizer[];
  issues: ImportIssue[];
}
export interface PlanningProposal {
  datasetId: string;
  exercise: string;
  indicatorProposals: Record<string, PlanningIndicator>;
  localIndicators: PlanningIndicator[];
  localizerProposals: Record<string, PlanningLocalizer>;
  justifications: Record<string, string>;
  migrationNotices: string[];
  editingVersion?: number;
  review?: Record<string, { status: 'pendente' | 'revisado'; reviewedAt?: string }>;
  history?: ProposalEvent[];
  associationRequests?: AssociationRequest[];
  intendedExercise?: string;
}

export type PlanningEntityKind = 'program' | 'action' | 'indicator' | 'localizer';
export interface ProposalEvent {
  id: string;
  entityId: string;
  kind: PlanningEntityKind;
  operation: 'exclusao' | 'restauracao' | 'descarte' | 'reversao' | 'vinculo';
  at: string;
  reason: string;
  before: unknown;
  after: unknown;
}
export interface AssociationRequest {
  id: string;
  entityId: string;
  kind: 'program' | 'action';
  before: { programId?: string; fields: OfficialFields };
  after: { programId?: string; fields: OfficialFields };
  affected: string[];
  reason: string;
}
