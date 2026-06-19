import { useState } from 'react';
import { AppProvider } from './store/AppStore';
import { ToastProvider } from './components/ui';
import { AppShell } from './components/AppShell';
import { LandingPage, ComposePage } from './pages/Simple';
import { MarcoLogicoPage } from './pages/MarcoLogico';
import { MapaProcessosPage } from './pages/MapaProcessos';
import { ObzPage } from './pages/OBZ';
import { CoerenciaPage } from './pages/Coerencia';
import { EspelhoPage } from './pages/Espelho';
import { AdminPage } from './pages/Admin';

interface RouteDef { page: string; tab?: string; area: string }
const ROUTES: Record<string, RouteDef> = {
  fpo: { page: 'landing', area: 'Formulação Programática-Orçamentária' },
  'ml-preenchimento': { page: 'ml', tab: 'teoria', area: 'Programação Qualitativa' },
  'ml-arvores': { page: 'ml', tab: 'arvores', area: 'Programação Qualitativa' },
  'ml-alternativas': { page: 'ml', tab: 'alternativas', area: 'Programação Qualitativa' },
  'mapa-preenchimento': { page: 'mapa', tab: 'preenchimento', area: 'Mapa de Processos e Resultados' },
  'mapa-subcategorias': { page: 'mapa', tab: 'subcategorias', area: 'Mapa de Processos e Resultados' },
  'mapa-visualizacao': { page: 'mapa', tab: 'visualizacao', area: 'Mapa de Processos e Resultados' },
  'obz-elaboracao': { page: 'obz', tab: 'elaboracao', area: 'Orçamento Base Zero' },
  'obz-cenarios': { page: 'obz', tab: 'cenarios', area: 'Orçamento Base Zero' },
  'obz-validacao': { page: 'obz', tab: 'validacao', area: 'Orçamento Base Zero' },
  'coer-matriz': { page: 'coer', tab: 'guiada', area: 'Casamento Programa-OBZ' },
  'coer-verificacao': { page: 'coer', tab: 'verificacao', area: 'Casamento Programa-OBZ' },
  'coer-comparativo': { page: 'coer', tab: 'comparativo', area: 'Casamento Programa-OBZ' },
  'esp-programa': { page: 'esp', tab: 'programa', area: 'Espelhos do Planejamento' },
  'esp-acao': { page: 'esp', tab: 'acao', area: 'Espelhos do Planejamento' },
  'esp-indicador': { page: 'esp', tab: 'indicador', area: 'Espelhos do Planejamento' },
  'esp-export': { page: 'esp', tab: 'export', area: 'Espelhos do Planejamento' },
  admin: { page: 'admin', area: 'Administrador' },
  planejamento: { page: 'compose', area: 'Planejamento' },
  relatorio: { page: 'compose', area: 'Relatório e Bases de Planejamento' },
  orcamento: { page: 'compose', area: 'Orçamento' },
};

function Router({ route, onNavigate }: { route: string; onNavigate: (id: string) => void }) {
  const def = ROUTES[route] || ROUTES.fpo;
  switch (def.page) {
    case 'landing': return <LandingPage onNavigate={onNavigate} />;
    case 'ml': return <MarcoLogicoPage key={route} initialTab={def.tab} />;
    case 'mapa': return <MapaProcessosPage key={route} initialTab={def.tab} />;
    case 'obz': return <ObzPage key={route} initialTab={def.tab} />;
    case 'coer': return <CoerenciaPage key={route} initialTab={def.tab} />;
    case 'esp': return <EspelhoPage key={route} initialTab={def.tab} />;
    case 'admin': return <AdminPage />;
    case 'compose': return <ComposePage route={route} />;
    default: return <LandingPage onNavigate={onNavigate} />;
  }
}

export default function App() {
  const [route, setRoute] = useState('fpo');
  const area = (ROUTES[route] || ROUTES.fpo).area;
  return (
    <AppProvider>
      <ToastProvider>
        <AppShell route={route} onNavigate={setRoute} area={area}>
          <Router route={route} onNavigate={setRoute} />
        </AppShell>
      </ToastProvider>
    </AppProvider>
  );
}
