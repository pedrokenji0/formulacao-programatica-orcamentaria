import type { ProblemNode, ObjectiveNode } from '../types';

type TreeKind = 'problem' | 'objective';
type TreeZone = 'canopy' | 'branches' | 'trunk' | 'roots' | 'soil';

interface LayerDef {
  name: string;
  types: string[];
  zone: TreeZone;
  cls: string;
}

const PROBLEM_LAYERS: LayerDef[] = [
  { name: 'Consequências finais', types: ['consequência final'], zone: 'canopy', cls: 'leaf dry' },
  { name: 'Consequências diretas', types: ['consequência direta'], zone: 'branches', cls: 'branch' },
  { name: 'Problema central', types: ['problema central'], zone: 'trunk', cls: 'central' },
  { name: 'Causas superficiais', types: ['causa superficial'], zone: 'roots', cls: 'root' },
  { name: 'Causas maiores', types: ['causa maior'], zone: 'roots', cls: 'root deep' },
  { name: 'Causas estruturais', types: ['causa estrutural'], zone: 'soil', cls: 'root soil' },
];

const OBJECTIVE_LAYERS: LayerDef[] = [
  { name: 'Fins / resultados desejados', types: ['fim'], zone: 'canopy', cls: 'leaf green' },
  { name: 'Objetivo central', types: ['objetivo central'], zone: 'trunk', cls: 'central' },
  { name: 'Meios / estratégias', types: ['meio'], zone: 'roots', cls: 'root green-root' },
];

export function TreeVisualizer({ kind, problemNodes, objectiveNodes }: {
  kind: TreeKind; problemNodes?: ProblemNode[]; objectiveNodes?: ObjectiveNode[];
}) {
  const layers = kind === 'problem' ? PROBLEM_LAYERS : OBJECTIVE_LAYERS;
  const nodes: { text: string; type: string; isParameter?: boolean }[] =
    kind === 'problem' ? (problemNodes || []) : (objectiveNodes || []);
  const params = nodes.filter((n) => (n as any).isParameter || n.type === 'parâmetro externo');

  return (
    <div className={`tree tree-${kind}`}>
      <div className="tree-stage">
        {layers.map((layer, li) => {
          const items = nodes.filter((n) => layer.types.includes(n.type));
          return (
            <div className={`tree-zone tree-zone-${layer.zone}`} key={layer.name}>
              <div className="lname">{layer.name}</div>
              <div className="nodes">
                {items.length === 0
                  ? <div className={`tnode ghost ${layer.cls}`}>—</div>
                  : items.map((n, i) => <div key={`${n.type}-${i}`} className={`tnode ${layer.cls}`}>{n.text}</div>)}
              </div>
              {li < layers.length - 1 && <div className={`connector connector-${layer.zone}`} />}
            </div>
          );
        })}
      </div>
      {params.length > 0 && (
        <div className="external-params">
          <div className="lname">Parâmetros externos</div>
          <div className="nodes">{params.map((n, i) => <div key={i} className="tnode param">{n.text}</div>)}</div>
        </div>
      )}
    </div>
  );
}
