import { useState } from 'react';
import type { MapItem, ProcessAction, ProcessMap } from '../types';
import { useApp } from '../store/AppStore';
import { FormField, ActionButton } from './ui';
import { stableLocalId } from '../services/planningDomain';
import { addActionItem, canAddActionItem, editorItems, editorLimit, itemSection, removeActionItem, setActionLink, type ActionEditorSection } from '../services/mapDomain';

const LABELS: Record<ActionEditorSection, string> = { recursos: 'Recursos reais', atividades: 'Atividades', produtoPrincipal: 'Produto principal', produtosSecundarios: 'Produtos / Entregas secundárias', resultados: 'Resultados', impactos: 'Impactos' };
const PLACEHOLDERS: Record<ActionEditorSection, string> = { recursos: 'Recurso/insumo...', atividades: 'Atividade/processo...', produtoPrincipal: 'Produto principal...', produtosSecundarios: 'Produto/entrega secundária...', resultados: 'Resultado esperado...', impactos: 'Impacto de longo prazo...' };

export function ActionItemLinks({ action, item, section, editable, updateMap }: { action: ProcessAction; item: MapItem; section: 'recursos' | 'atividades'; editable: boolean; updateMap: (apply: (target: ProcessMap) => void) => void }) {
  const targets = section === 'recursos' ? action.atividades : action.produtos;
  const kind = section === 'recursos' ? 'atividade' : 'produto';
  return <fieldset className="map-item-links"><legend>{section === 'recursos' ? 'Atividades que utilizam este recurso' : 'Produtos / entregas para os quais esta atividade contribui'}</legend>
    {!targets.length && <p className="small muted">Cadastre {section === 'recursos' ? 'atividades' : 'produtos / entregas'} nesta ação para selecionar os vínculos depois.</p>}
    <div className="multi-pick">{targets.map((target, index) => <label key={target.id}><input type="checkbox" aria-label={`Vincular ${item.texto} → ${target.texto}`} disabled={!editable} checked={item.associations?.some((link) => link.actionId === action.id && link.kind === kind && link.componentId === target.id) || false} onChange={(event) => updateMap((map) => { const record = map.actions.find((candidate) => candidate.id === action.id); if (record) setActionLink(record, section, item.id, target.id, event.target.checked); })} /><span>{index + 1}. {target.texto}</span></label>)}</div>
  </fieldset>;
}

export function ActionMapItems({ action, section, updateMap, editable }: { action: ProcessAction; section: ActionEditorSection; updateMap: (apply: (target: ProcessMap) => void) => void; editable: boolean }) {
  const { state } = useApp();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [preProduct, setPreProduct] = useState('');
  const key = itemSection(section);
  const items = editorItems(action, section);
  const label = LABELS[section];
  const canAdd = editable && canAddActionItem(action, section);
  const categories = key === 'recursos' ? state.lists.categoriasRecurso : key === 'atividades' ? state.lists.categoriasAtividade : key === 'produtos' ? state.lists.categoriasProduto : [];
  const changeItem = (id: string, apply: (item: MapItem) => void) => updateMap((map) => { const item = map.actions.find((record) => record.id === action.id)?.[key]?.find((record) => record.id === id); if (item) apply(item); });
  const add = () => {
    if (!canAdd || !text.trim()) return;
    updateMap((map) => { const record = map.actions.find((candidate) => candidate.id === action.id); if (record) addActionItem(record, section, { id: stableLocalId(key), texto: text.trim(), origin: 'local', categoria: category || undefined, preProduto: preProduct.trim() || undefined }); });
    setText(''); setCategory(''); setPreProduct('');
  };
  return <section aria-label={`Linhas de ${label}`}>
    <div className="map-lines-heading"><h3>{label}</h3><span className="pill-count">{items.length}/{editorLimit(section)}</span></div>
    <p className="small muted">Uma linha por item, nesta ação e UO. {section === 'produtoPrincipal' ? 'Uma entrega principal; outros produtos ficam em Entregas secundárias.' : section === 'produtosSecundarios' ? 'Até 7 entregas secundárias, além do produto principal (8 no total).' : 'Até 8 linhas independentes por grupo.'} Os vínculos são escolhas locais, não automáticos.</p>
    {items.map((item, index) => <div key={item.id} className="map-item-editor">
      <span className={`badge ${item.origin === 'importado' ? 'blue' : 'purple'}`}>{item.origin === 'importado' ? 'Referência importada PPO' : item.origin === 'confirmado' ? 'Confirmado pelo usuário' : 'Complemento local'}</span>
      <FormField label={`${label} — item ${index + 1}`} textarea value={item.texto} disabled={!editable} onChange={(value) => changeItem(item.id, (record) => { record.texto = value; record.origin = 'local'; })} />
      {categories.length > 0 && <label className="planning-selector">Categoria do item {index + 1}<select disabled={!editable} value={item.categoria || ''} onChange={(event) => changeItem(item.id, (record) => { record.categoria = event.target.value; })}><option value="">Não informada</option>{[...new Set([...categories, ...(item.categoria ? [item.categoria] : [])])].map((value) => <option key={value}>{value}</option>)}</select></label>}
      {section === 'atividades' && <FormField label={`Pré-produto — item ${index + 1}`} value={item.preProduto || ''} disabled={!editable} onChange={(value) => changeItem(item.id, (record) => { record.preProduto = value; })} />}
      {key === 'produtos' && <details><summary>Públicos-alvo da entrega</summary><div className="multi-pick">{[...new Set([...state.lists.publicos, ...(item.publicos || [])])].map((value) => <label key={value}><input type="checkbox" disabled={!editable} checked={item.publicos?.includes(value) || false} onChange={(event) => changeItem(item.id, (record) => { record.publicos = (record.publicos || []).filter((entry) => entry !== value); if (event.target.checked) record.publicos.push(value); })} />{value}</label>)}</div></details>}
      {(section === 'recursos' || section === 'atividades') && <ActionItemLinks action={action} item={item} section={section} editable={editable} updateMap={updateMap} />}
      <ActionButton sm color="ghost" disabled={!editable} onClick={() => updateMap((map) => removeActionItem(map, action.id, key, item.id))}>Remover item {index + 1}</ActionButton>
    </div>)}
    {!items.length && <p className="small muted">Nenhuma linha cadastrada. Você pode incluir um item agora e fazer os vínculos depois.</p>}
    <div className="map-add-line"><FormField label={`Nova linha — ${label}`} placeholder={PLACEHOLDERS[section]} value={text} disabled={!canAdd} onChange={setText} textarea />
      {!!categories.length && <label className="planning-selector">Categoria da nova linha<select value={category} disabled={!canAdd} onChange={(event) => setCategory(event.target.value)}><option value="">Não informada</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>}
      {section === 'atividades' && <FormField label="Pré-produto da nova atividade (opcional)" value={preProduct} disabled={!canAdd} onChange={setPreProduct} />}
      <ActionButton color="green" disabled={!canAdd || !text.trim()} onClick={add}>Criar</ActionButton>
      {!canAddActionItem(action, section) && <p role="status" className="small muted">Limite atingido. Edite ou remova uma linha para incluir outra. Registros anteriores são preservados.</p>}
    </div>
  </section>;
}
