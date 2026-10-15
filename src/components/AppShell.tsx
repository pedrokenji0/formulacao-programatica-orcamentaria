import { useEffect, useState } from 'react';
import { Building2, Menu, UserRound, X } from 'lucide-react';
import { SidebarMenu } from './SidebarMenu';
import { useApp } from '../store/AppStore';
import type { Perfil } from '../types';

const PERFIS: Perfil[] = ['Leitor', 'Gestor UA', 'Gestor Setorial', 'Central Geral', 'Consulta', 'Técnico do Órgão', 'Validador do Órgão', 'DCMEFO/SEPLAG', 'Administrador'];
const portalLogo = `${import.meta.env.BASE_URL}logo-portal-planejamento.svg`;

export function AppShell({ route, onNavigate, area, children }: {
  route: string; onNavigate: (id: string) => void; area: string; children: React.ReactNode;
}) {
  const { state, setPerfil, setUnidade } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEsc);
    return () => window.removeEventListener('keydown', closeOnEsc);
  }, []);

  const navigateFromMenu = (id: string) => {
    onNavigate(id);
    setOpen(false);
  };

  return (
    <div className="shell">
      <header className="topbar">
        <button className="hamb" aria-label="Menu" title={open ? 'Fechar menu' : 'Abrir menu'} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="brand">
          <img src={portalLogo} alt="Portal de Planejamento e Orçamento - MG" />
        </div>
        <span className="area">{area}</span>
        <div className="spacer" />
        <div className="top-select">
          <Building2 size={15} />
          <select value={state.unidade} onChange={(e) => setUnidade(e.target.value)} title="Unidade">
            {state.lists.unidades.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="top-select profile-sel">
          <UserRound size={15} />
          <select value={state.perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
            {PERFIS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </header>
      <div className={'body' + (open ? ' menu-open' : '')}>
        {open && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
        <SidebarMenu open={open} route={route} onNavigate={navigateFromMenu} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
