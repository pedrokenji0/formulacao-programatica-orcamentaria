export type ProjectComponentKind = 'contexto' | 'recurso' | 'atividade' | 'produto' | 'resultado' | 'impacto' | 'pressuposto';
export type IndicatorStage = Exclude<ProjectComponentKind, 'contexto' | 'pressuposto'>;
export interface MapDocumentSource {
  referenceId: string;
  title: string;
  year: number;
  figure: string;
  printedPage: number;
  pdfPage: number;
}
export interface ProjectComponent {
  id: string;
  kind: ProjectComponentKind;
  order: number;
  text: string;
  origin: 'avaliacao' | 'local';
  source: MapDocumentSource | null;
  actionIds: string[];
}
export interface ProjectIndicator {
  id: string;
  stage: IndicatorStage;
  order: number;
  name: string;
  officialCode: string;
  formula: string;
  unit: string;
  frequency: string;
  polarity: string;
  definition: string;
  dataSource: string;
  geography: string;
  referenceIndex: string;
  referenceDate: string;
  origin: 'avaliacao' | 'local';
  source: MapDocumentSource | null;
  links: { componentId: string; status: 'sugerido' | 'confirmado' }[];
}
export interface ProjectPlanningMap {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  ownerProgramId: string;
  actionIds: string[];
  referenceVersion: string;
  components: ProjectComponent[];
  indicators: ProjectIndicator[];
  relations: { id: string; fromId: string; toId: string; status: 'sugerido' | 'confirmado' }[];
}
