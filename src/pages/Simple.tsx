import { useApp } from '../store/AppStore';
import { Card, Stat, ActionButton, StatusBadge, brl } from '../components/ui';
import { CoherenceScore } from '../components/CoherenceScore';
import { PageHeader } from '../components/PageHeader';
import { mockApi } from '../services/mockApi';
import { ArrowRight, CheckCircle2, GitBranch, Network, Coins, Scale, ClipboardList } from 'lucide-react';

export function LandingPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { state } = useApp();
  const pid = state.currentProgramId;
  const prog = state.programs.find((p) => p.id === pid);
  const fw = state.frameworks.find((f) => f.programId === pid);
  const items = state.budgetItems.filter((b) => b.programaId === pid);
  const total = items.reduce((s, b) => s + b.valorTotal, 0);
  const limiar = items.filter((b) => b.classificacaoCenario === 'LIMIAR').reduce((s, b) => s + b.valorTotal, 0);
  const coher = mockApi.calculateCoherenceScore(pid);

  const modulos = [
    {
      id: 'qual-programa', etapa: '1.1', label: 'Programação Qualitativa', icon: GitBranch,
      desc: 'Cadastros do PPO, ações e entregas, indicadores, território e proposta local.', status: fw?.status,
      checks: ['Programa e indicadores', 'Ações e Entregas', 'Mapa e Revisão do Planejamento'],
    },
    {
      id: 'obz-elaboracao', etapa: '1.2', label: 'Orçamento Base Zero', icon: Coins,
      desc: `${items.length} itens classificados, total de ${brl(total)}.`, status: prog?.status,
      checks: ['Classificação orçamentária detalhada', 'Perfis N3, N2, N1 e DCMEFO', 'Validação com comentário'],
    },
    {
      id: 'coer-matriz', etapa: '1.3', label: 'Casamento Programa-OBZ', icon: Scale,
      desc: `${state.links.length} vínculos registrados entre itens OBZ e cadeia operacional.`,
      checks: ['Foco no item OBZ', 'Recursos reais associados', 'Atividades e pré-produtos'],
    },
    {
      id: 'esp-programa', etapa: '1.4', label: 'Espelhos do Planejamento', icon: ClipboardList,
      desc: 'Aproveita o preenchimento qualitativo para simular campos oficiais.',
      checks: ['Programa', 'Ação', 'Indicadores e exportação'],
    },
  ];

  return (
    <>
      <PageHeader crumb="1. Formulação Programática-Orçamentária" title="Tela inicial do macroprocesso"
        sub="Quatro processos conectados: os dois primeiros funcionam de forma independente, o terceiro cruza Programa e OBZ, e o quarto transforma o preenchimento em espelhos para o planejamento." status={prog?.status} />

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat k="ITENS OBZ" v={items.length} color="blue" />
        <Stat k="TOTAL PLANEJADO" v={brl(total)} />
        <Stat k="LIMIAR" v={brl(limiar)} />
        <Stat k="INCREMENTAL" v={brl(total - limiar)} color="orange" />
      </div>

      <div className="process-grid">
        {modulos.map((m) => (
          <button key={m.id} className="process-card" onClick={() => onNavigate(m.id)}>
            <span className="process-index">{m.etapa}</span>
            <span className="process-icon"><m.icon size={20} /></span>
            <span className="process-title">{m.label}</span>
            <span className="process-desc">{m.desc}</span>
            <span className="process-checks">
              {m.checks.map((c) => <span key={c}><CheckCircle2 size={13} />{c}</span>)}
            </span>
            <span className="process-foot">
              {m.status ? <StatusBadge status={m.status} /> : <span className="badge gray">apoio</span>}
              <ArrowRight size={17} />
            </span>
          </button>
        ))}
      </div>

      <div className="grid g2">
        <Card title="Programa selecionado">
          <div className="kv"><span>Código / Nome</span><span className="v">{prog?.codigo} — {prog?.nome}</span></div>
          <div className="kv"><span>Unidade orçamentária</span><span className="v">{prog?.unidadeOrcamentaria}</span></div>
          <div className="kv"><span>Órgão</span><span className="v">{prog?.orgao}</span></div>
          <div className="kv"><span>Problema central</span><span className="v" style={{ maxWidth: 360, textAlign: 'right' }}>{prog?.problemaCentral || '—'}</span></div>
        </Card>

        <Card title="Estado do desenho">
          <CoherenceScore value={coher} label="Nota de coerência do mapa (0-100)" sub="Calculada a partir do preenchimento da cadeia causal." />
          <div className="row" style={{ marginTop: 14 }}>
            <ActionButton color="blue" icon={<Network size={16} />} onClick={() => onNavigate('qual-mapa')}>Ver mapa</ActionButton>
            <ActionButton color="ghost" icon={<ArrowRight size={16} />} onClick={() => onNavigate('coer-matriz')}>Abrir casamento OBZ</ActionButton>
          </div>
        </Card>
      </div>

      <div className="workflow-strip">
        <div><b>Fluxo de trabalho</b><span>Programação Qualitativa</span></div>
        <ArrowRight size={18} />
        <div><b>Base independente</b><span>OBZ e classificações</span></div>
        <ArrowRight size={18} />
        <div><b>Casamento</b><span>Item OBZ + recursos + atividades</span></div>
        <ArrowRight size={18} />
        <div><b>Uso final</b><span>Espelhos para planejamento</span></div>
      </div>
    </>
  );
}

export function ComposePage({ route }: { route: string }) {
  const titles: Record<string, { t: string; d: string }> = {
    planejamento: { t: 'Planejamento', d: 'Módulo existente no sistema oficial (PPO). Aqui aparece apenas para compor a navegação do protótipo.' },
    relatorio: { t: 'Relatório e Bases de Planejamento', d: 'Módulo existente no sistema oficial (PPO). Apenas composição de navegação no protótipo.' },
    orcamento: { t: 'Orçamento', d: 'Módulo existente no sistema oficial (PPO/SISOR). Apenas composição de navegação no protótipo.' },
  };
  const info = titles[route] || { t: route, d: '' };
  return (
    <>
      <PageHeader crumb="Sistema oficial (PPO)" title={info.t} sub={info.d} showProgram={false} />
      <Card>
        <div className="empty">Tela ilustrativa — integra-se ao módulo correspondente do sistema oficial.</div>
      </Card>
    </>
  );
}
