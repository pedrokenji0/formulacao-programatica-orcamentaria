# Formulação Programática-Orçamentária — protótipo (PPO-MG)

Protótipo **100% front-end** (sem backend) de uma ferramenta de apoio à formulação de programas e à
elaboração do **Orçamento Base Zero (OBZ)**, com verificação de **coerência Programa-OBZ** e geração de
**espelhos** para o sistema oficial de Planejamento e Orçamento de Minas Gerais (PPO).

Stack: **React 18 + TypeScript + Vite**. Ícones `lucide-react`. Importação de planilhas com `xlsx` (SheetJS).
Estado persistido em **localStorage** e camada de **mock API** (`src/services/mockApi.ts`).

---

## Como instalar

Pré-requisito: Node.js 18+.

```bash
npm install
```

## Como rodar

```bash
npm run dev        # ambiente de desenvolvimento (http://localhost:5173)
npm run build      # gera o bundle de produção em dist/
npm run preview    # serve o bundle de produção
npm run typecheck  # checagem de tipos (tsc --noEmit)
```

---

## Telas existentes

**Formulação do Programa**
- **Marco Lógico** — Teoria do Problema, Análise de Envolvidos, Árvore de Problemas (visualização em
  camadas: folhas → tronco → raízes), Árvore de Objetivos (gerada automaticamente a partir dos problemas),
  Análise de Alternativas (com matriz de decisão ponderada) e Síntese (nota de coerência 0–100).
- **Mapa de Processos e Resultados** — Preenchimento (programa + ações com recursos → atividades →
  produtos → resultados → impactos), Subcategorias, Visualização do Mapa (cadeia causal em cards) e
  Validação do Desenho (alertas + nota de coerência).

**Formulação do Orçamento (OBZ)**
- **Elaboração** — tabela de itens + modal detalhado (valor = volume × preço × frequência; travas de
  cenário Limiar/Incremental e de prioridade N3/N2/N1).
- **Importação da Planilha** — assistente de importação `.xlsx`.
- **Cenários e Priorização** — totais por ação, agrupamento, elemento-item e fonte, com filtros.
- **Validação OBZ** — regras por item e fluxo N3 → N2/N1 → DCMEFO/SEPLAG.

**Coerência Programa-OBZ**
- **Associação Guiada por Item** (tela principal): vincula cada item OBZ à cadeia operacional da ação
  (Ação → Recurso → Atividade → Produto → Resultado → Impacto).
- **Matriz de Coerência**, **Verificação de Ligações** (4 notas de coerência) e **Comparativo Programa x OBZ**.

**Espelho para Planejamento**
- Simulação de preenchimento do **Programa**, da **Ação** e do **Indicador** (pré-preenchidos a partir do
  Marco Lógico e do Mapa) e **Exportar/Importar** (JSON e CSV).

**Configurações e Tabelas de Apoio** (perfil Administrador) — CRUD das listas de apoio, matriz de
permissões por perfil, importação/exportação e governança.

**Planejamento / Relatório / Orçamento** — telas ilustrativas (existem no sistema oficial; aqui apenas
compõem a navegação).

---

## Como importar a planilha OBZ

1. Vá em **Formulação do Orçamento → Importação da Planilha**.
2. Clique em **Selecionar planilha .xlsx** e escolha o arquivo (ex.: a base OBZ de um órgão).
3. O sistema procura a aba **BASE OBZ** (ou a primeira aba com a coluna “Descrição do item”), detecta os
   cabeçalhos e aceita variações (`AÇÃO`/`ACAO`, `UNIDADE ORÇAMENTÁRIA`/`UO`, `ELEMENTO_ITEM`, etc.).
4. Ajuste o **mapeamento de colunas** se necessário, confira a **prévia** e clique em **Confirmar importação**.
   Os itens e as listas de seleção (programas, ações, elementos-itens, agrupamentos, fontes, UOs) são populados.

> Caso nenhuma planilha seja importada, o protótipo já vem com dados de exemplo.

## Como trocar de perfil

No canto superior direito há o seletor de **perfil**: *Consulta, Técnico do Órgão (N3), Validador do Órgão
(N2/N1), DCMEFO/SEPLAG, Administrador*. Os botões de edição, validação, bloqueio e administração habilitam
ou desabilitam conforme o perfil. Há também o seletor de **unidade** e o seletor de **programa ativo**.

## Como exportar / importar estado

Em **Espelho para Planejamento → Exportar / Importar**:
- exportar espelho do programa / ações / indicadores (JSON);
- exportar **pacote completo** (todo o estado) em JSON;
- exportar **CSV simplificado** da OBZ;
- **importar pacote JSON** para restaurar um trabalho anterior;
- **restaurar dados de exemplo**.

Todo o estado é salvo automaticamente em `localStorage` (chave `fpo-state-v1`).

---

## Dados de exemplo

- **Programa-vitrine 105 — Formação e Capacitação Técnico-Cultural / Ação 1029 (FAOP)** completo: marco
  lógico (teoria do problema, árvores, alternativas), mapa de processos e 5 itens OBZ
  (R$ 66.200 — Limiar R$ 34.600 / Incremental R$ 31.600).
- **Dados reais** de programas, ações e itens OBZ dos órgãos **SES (FES), SEJUSP, SEE e SEPLAG**,
  extraídos das planilhas OBZ fornecidas, mais detalhes de ações (finalidade, descrição, público-alvo,
  produto, função/subfunção, IAG, base legal) das bases do PPAG.

---

## Estrutura

```
src/
  types/index.ts          modelos do domínio
  data/mockData.ts        dados de exemplo (vitrine + 4 órgãos) e listas
  data/seed.json          seed extraído das planilhas reais
  services/mockApi.ts     mock API + persistência em localStorage
  store/AppStore.tsx      estado global, perfis/permissões, export/import
  components/             AppShell, SidebarMenu, PageHeader, DataTable, ValidationPanel,
                          CoherenceScore, ImportWizard, TreeVisualizer, MapVisualizer, MirrorForm, ui
  pages/                  MarcoLogico, MapaProcessos, OBZ, Coerencia, Espelho, Admin, Simple
  public/                 assets estáticos usados pelo build (logo do portal)
bases_csv/
  classificador_despesa/  CSVs do classificador de despesa por tabela/aba
  obz/                    bases OBZ por órgão ou rodada
  planejamento/           programas, ações, localizadores e unidades orçamentárias
```

## Bases CSV locais

A pasta `bases_csv/` organiza os arquivos que você deve substituir pelas bases reais:

- `bases_csv/classificador_despesa/`: `grupos_despesa.csv`, `elementos_despesa.csv`, `elementos_itens_despesa.csv`, `agrupamentos_despesa.csv`, `fontes_recursos.csv`, `funcoes.csv`, `subfuncoes.csv`, `iag.csv`.
- `bases_csv/obz/`: use `base_obz_modelo.csv` como referência e salve bases por órgão, por exemplo `base_obz_1261_see.csv`.
- `bases_csv/planejamento/`: `programas.csv`, `acoes.csv`, `localizadores.csv`, `unidades_orcamentarias.csv`.

---

## Limitações do protótipo

- Sem backend, banco de dados ou autenticação reais — tudo roda no navegador, com estado em `localStorage`.
- A “mock API” simula chamadas REST com atraso, mas não há persistência em servidor.
- Os perfis não fazem login real; servem para **simular** as permissões.
- A profundidade varia entre módulos: a Formulação do Programa, a OBZ e a Coerência (Associação Guiada)
  são as mais completas; alguns painéis administrativos e comparativos são funcionais, porém mais simples.
- A importação cobre o layout da **BASE OBZ** fornecida; planilhas com estrutura muito diferente podem
  exigir ajuste manual do mapeamento de colunas.
- Arquitetura pensada para posterior integração ao PPO/SIGPLAN-SISOR, mas a integração em si não está
  implementada.
