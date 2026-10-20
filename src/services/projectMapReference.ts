import components from '../../data/referencias/reurb/data/componentes.json' with { type: 'json' };
import indicators from '../../data/referencias/reurb/data/indicadores.json' with { type: 'json' };
import indicatorLinks from '../../data/referencias/reurb/data/indicador_componentes.json' with { type: 'json' };
import relations from '../../data/referencias/reurb/data/relacoes_componentes.json' with { type: 'json' };
import projects from '../../data/referencias/reurb/data/projetos.json' with { type: 'json' };
import maps from '../../data/referencias/reurb/data/mapas.json' with { type: 'json' };
import type { Action, ProjectPlanningMap, ProjectComponentKind, IndicatorStage, MapDocumentSource } from '../types/index.ts';

const code = (value: string | undefined) => String(value || '').trim().replace(/^0+(?=\d)/, '');
const source = (row: { fonte_id: string; figura: string; pagina_impressa: number; pagina_pdf: number }): MapDocumentSource => ({
  referenceId: row.fonte_id, title: 'Avaliação do Programa Minas Reurb — relatório final', year: 2025,
  figure: row.figura, printedPage: row.pagina_impressa, pdfPage: row.pagina_pdf,
});

// The document owns the reference; PPO only supplies the participating actions.
// Components are shared at project level, never copied into each action/UO.
export function createProjectMapReferences(actions: Action[]): ProjectPlanningMap[] {
  const participants = actions.filter((action) => code(action.codigoProjetoEstrategico) === '14');
  if (!participants.length) return [];
  return [{
    id: maps.data[0].mapa_id,
    projectId: projects.data[0].projeto_id,
    projectCode: '14', projectName: 'Minas Reurb',
    ownerProgramId: participants.find((action) => code(action.codigo) === '1082' && code(action.codigoUnidadeOrcamentaria) === '1221')?.programaId || participants[0].programaId,
    actionIds: participants.map((action) => action.id),
    referenceVersion: 'mapa-minas-reurb-relatorio2025-v1',
    ...referenceContent(),
  }];
}

export function hasProjectMapReference(map: ProjectPlanningMap) {
  return map.origin !== 'local' && map.id === maps.data[0].mapa_id && map.projectId === projects.data[0].projeto_id && map.referenceVersion === 'mapa-minas-reurb-relatorio2025-v1';
}

export function originalProjectMap(map: ProjectPlanningMap): ProjectPlanningMap {
  // The metadata identifies the same logical map; reference content is always rebuilt
  // from the versioned source, never from localStorage or the current proposal.
  return { ...structuredClone(map), ...(hasProjectMapReference(map) ? referenceContent() : { components: [], indicators: [], relations: [] }) };
}

function referenceContent(): Pick<ProjectPlanningMap, 'components' | 'indicators' | 'relations'> {
  return {
    components: components.data.map((row) => ({
      id: row.componente_id, kind: row.tipo as ProjectComponentKind, order: row.ordem_na_coluna,
      text: row.texto_original, origin: 'avaliacao', source: source(row), actionIds: [],
    })),
    indicators: indicators.data.map((row) => ({
      id: row.indicador_id, stage: row.categoria_original as IndicatorStage, order: row.ordem_na_coluna,
      name: row.nome_original, officialCode: row.codigo_oficial_PPO || '', formula: row.formula_calculo || '',
      unit: row.unidade_medida || '', frequency: row.periodicidade_coleta || '', polarity: row.polaridade || '',
      definition: row.definicao_operacional || '', dataSource: row.fonte_dados_medicao || '', geography: '', referenceIndex: '', referenceDate: '',
      origin: 'avaliacao', source: source(row),
      links: indicatorLinks.data.filter((link) => link.indicador_id === row.indicador_id).map((link) => ({ componentId: link.componente_id, status: 'sugerido' })),
    })),
    relations: relations.data.map((row) => ({ id: row.relacao_id, fromId: row.origem_componente_id, toId: row.destino_componente_id, status: 'sugerido' })),
  };
}
