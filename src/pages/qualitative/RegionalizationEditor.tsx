import { useState } from 'react';
import { useApp } from '../../store/AppStore';
import { ActionButton, FormField, Modal } from '../../components/ui';
import { assignMunicipalities, canEditTerritory, normalizeTerritoryText } from '../../services/territoryDomain';
import type { TerritoryDataset } from '../../types';

export function RegionalizationEditor({ id, data, initialCode, onClose }: { id: string; data: TerritoryDataset; initialCode: string; onClose: () => void }) {
  const { state, update, saveNow } = useApp();
  const scheme = state.territory?.regionalizations.find((record) => record.id === id);
  const [regionName, setRegionName] = useState(''), [query, setQuery] = useState(''), [regionId, setRegionId] = useState(scheme?.regions[0]?.id || '');
  const [codes, setCodes] = useState<string[]>(initialCode ? [initialCode] : []), [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  if (!scheme) return null;
  const editable = canEditTerritory(state, scheme);
  const filtered = data.municipalities.filter((m) => (!query || normalizeTerritoryText(m.name + ' ' + m.code).includes(normalizeTerritoryText(query))) && (!filter || (filter === 'unassigned' ? !scheme.memberships[m.code] : scheme.memberships[m.code] === filter)));
  const change = (apply: (target: typeof scheme) => void) => update((draft) => { const target = draft.territory?.regionalizations.find((record) => record.id === id); if (target) apply(target); });
  const addRegion = () => {
    if (!regionName.trim()) return;
    if (scheme.regions.some((region) => normalizeTerritoryText(region.name) === normalizeTerritoryText(regionName))) { setError('Já existe uma região com esse nome.'); return; }
    const region = { id: 'regiao-local-' + crypto.randomUUID(), name: regionName.trim() };
    change((target) => target.regions.push(region)); setRegionId(region.id); setRegionName(''); setError('');
  };
  return <Modal wide title="Editar regionalização" sub={scheme.department + ' · ' + scheme.referenceYear + ' · alterações salvas na proposta'} onClose={onClose} foot={<ActionButton onClick={() => { void saveNow(); onClose(); }}>Concluir regionalização</ActionButton>}>
    <div className="project-record-editor"><section className="sheet-section"><h2>{scheme.name}</h2>
      <div className="grid g2"><FormField label="Nome da regionalização" value={scheme.name} disabled={!editable} onChange={(value) => change((target) => { target.name = value; })} /><FormField label="Secretaria ou órgão da regionalização" value={scheme.department} disabled={!editable} onChange={(value) => change((target) => { target.department = value; })} /></div>
      <p>{Object.keys(scheme.memberships).length} de 853 municípios atribuídos · {scheme.regions.length} regiões</p>
    </section><section className="sheet-section"><h2>Regiões</h2><div className="territory-create-region"><FormField label="Nome da nova região" value={regionName} disabled={!editable} onChange={setRegionName} /><ActionButton disabled={!editable || !regionName.trim()} onClick={addRegion}>Adicionar região</ActionButton></div>
      <div className="territory-region-tags">{scheme.regions.map((region) => <span className="badge blue" key={region.id}>{region.name} · {Object.values(scheme.memberships).filter((id) => id === region.id).length}</span>)}</div>
    </section><section className="sheet-section"><h2>Composição municipal</h2><div className="grid g2">
      <FormField label="Pesquisar municípios da regionalização" value={query} onChange={setQuery} />
      <label className="field">Mostrar municípios<select aria-label="Mostrar municípios" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Todos</option><option value="unassigned">Sem região atribuída</option>{scheme.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>
    </div>
      <div className="territory-bulk-tools"><label className="field">Região de destino<select aria-label="Região de destino" value={regionId} disabled={!editable} onChange={(event) => setRegionId(event.target.value)}><option value="">Remover atribuição</option>{scheme.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>
        <ActionButton disabled={!editable || !codes.length} onClick={() => { try { change((target) => assignMunicipalities(target, codes, regionId, data)); setCodes([]); setError(''); } catch (cause) { setError(String(cause)); } }}>Aplicar aos {codes.length} selecionados</ActionButton>
        <ActionButton sm color="ghost" disabled={!editable} onClick={() => setCodes([...new Set([...codes, ...filtered.map((m) => m.code)])])}>Selecionar resultado da pesquisa</ActionButton><ActionButton sm color="ghost" onClick={() => setCodes([])}>Limpar seleção</ActionButton>
      </div><p className="small muted">Cada município participa de uma região nesta divisão. Outras secretarias podem ter divisões diferentes. Aplicar uma região substitui a atribuição anterior nesta divisão.</p>
      <div className="territory-municipality-checks">{filtered.slice(0, 50).map((m) => <label className="project-map-check" key={m.code}><input type="checkbox" aria-label={'Selecionar ' + m.name} disabled={!editable} checked={codes.includes(m.code)} onChange={(event) => setCodes(event.target.checked ? [...codes, m.code] : codes.filter((code) => code !== m.code))} /><span><strong>{m.name} · {m.code}</strong><small>{scheme.regions.find((region) => region.id === scheme.memberships[m.code])?.name || 'Sem região atribuída'}</small></span></label>)}</div>
      {filtered.length > 50 && <p className="small muted">Exibindo 50 de {filtered.length} municípios. Refine a pesquisa ou selecione todo o resultado.</p>}
      {error && <p className="alert err" role="alert">{error}</p>}
    </section></div>
  </Modal>;
}
