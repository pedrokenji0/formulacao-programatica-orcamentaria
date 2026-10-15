import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../store/AppStore';

interface NavNode { id: string; label: string; route?: string; perm?: 'adminTabelas'; children?: NavNode[] }

const MENU: NavNode[] = [
  {
    id: 'fpo-root', label: '1. FORMULAÇÃO PROGRAMÁTICA-ORÇAMENTÁRIA', children: [
      { id: 'fpo-home', label: 'Tela inicial do macroprocesso', route: 'fpo' },
      {
        id: 'qualitativa', label: '1.1 PROGRAMAÇÃO QUALITATIVA', children: [
          { id: 'qual-programa', label: 'Programa', route: 'qual-programa' },
          { id: 'qual-acoes', label: 'Ações e Entregas', route: 'qual-acoes' },
          { id: 'qual-mapa', label: 'Mapa de Processos e Resultados', route: 'qual-mapa' },
          { id: 'qual-revisao', label: 'Revisão do Planejamento', route: 'qual-revisao' },
        ],
      },
      {
        id: 'obz', label: '1.2 ORÇAMENTO BASE ZERO', children: [
          { id: 'obz-elaboracao', label: 'Itens OBZ e Classificação', route: 'obz-elaboracao' },
          { id: 'obz-cenarios', label: 'Cenários e Priorização', route: 'obz-cenarios' },
          { id: 'obz-validacao', label: 'Validação DCMEFO / Fluxo', route: 'obz-validacao' },
        ],
      },
      {
        id: 'coer', label: '1.3 CASAMENTO PROGRAMA-OBZ', children: [
          { id: 'coer-matriz', label: 'Matriz por Item OBZ', route: 'coer-matriz' },
          { id: 'coer-verificacao', label: 'Verificação de Ligações', route: 'coer-verificacao' },
          { id: 'coer-comparativo', label: 'Comparativo Programa x OBZ', route: 'coer-comparativo' },
        ],
      },
      {
        id: 'esp', label: '1.4 ESPELHOS DO PLANEJAMENTO', children: [
          { id: 'esp-programa', label: 'Campos do Programa', route: 'esp-programa' },
          { id: 'esp-acao', label: 'Campos da Ação', route: 'esp-acao' },
          { id: 'esp-indicador', label: 'Indicadores', route: 'esp-indicador' },
          { id: 'esp-export', label: 'Exportar / Importar', route: 'esp-export' },
        ],
      },
    ],
  },
  { id: 'planejamento', label: '2. PLANEJAMENTO', route: 'planejamento' },
  { id: 'relatorio', label: '3. RELATÓRIO E BASES DO PLANEJAMENTO', route: 'relatorio' },
  { id: 'orcamento', label: '4. ORÇAMENTO', route: 'orcamento' },
  { id: 'admin', label: 'ADMINISTRADOR', route: 'admin', perm: 'adminTabelas' },
];

export function SidebarMenu({ open, route, onNavigate }: { open: boolean; route: string; onNavigate: (id: string) => void }) {
  const { can } = useApp();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'fpo-root': true,
    qualitativa: true,
  });

  const containsRoute = (node: NavNode): boolean => node.route === route || Boolean(node.children?.some(containsRoute));

  const renderNode = (node: NavNode, depth = 0) => {
    const locked = node.perm ? !can(node.perm) : false;
    const hasChildren = Boolean(node.children?.length);
    const branchActive = containsRoute(node);
    const isExpanded = hasChildren && (expanded[node.id] ?? branchActive);
    const isActive = node.route === route;

    if (hasChildren) {
      return (
        <div className="menu-node" key={node.id}>
          <button
            type="button"
            className={'menu-row branch' + (isExpanded ? ' open' : '') + (branchActive ? ' active-branch' : '')}
            style={{ paddingLeft: 10 + depth * 24 }}
            onClick={() => setExpanded((s) => ({ ...s, [node.id]: !isExpanded }))}
            disabled={locked}
          >
            <ChevronRight className="menu-chevron" size={16} />
            <span>{node.label}</span>
          </button>
          {isExpanded && <div className="menu-children">{node.children?.map((child) => renderNode(child, depth + 1))}</div>}
        </div>
      );
    }

    return (
      <button
        type="button"
        key={node.id}
        className={'menu-row leaf' + (isActive ? ' active' : '') + (locked ? ' lock' : '')}
        style={{ paddingLeft: 10 + depth * 24 }}
        onClick={() => !locked && node.route && onNavigate(node.route)}
        disabled={locked}
        title={locked ? 'Apenas Administrador' : undefined}
      >
        <span className="menu-indent" />
        <span>{node.label}</span>
      </button>
    );
  };

  return (
    <nav className={'sidebar portal-menu' + (open ? '' : ' closed')} aria-label="Menu principal">
      {MENU.map((node) => renderNode(node))}
    </nav>
  );
}
