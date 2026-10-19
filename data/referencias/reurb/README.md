# Dataframes do MaPR e MaInd do Minas Reurb

Base preparada a partir das figuras 2 e 3 da avaliação fornecida pelo usuário e das duas ações do projeto estratégico 14 na referência PPO plan2026, commit `eac7892`.

Local no repositório: `data/referencias/reurb/`. O frontend e `npm run generate:data` ainda não consomem estes arquivos. Para inspecionar os dataframes a partir da raiz do repositório, com pandas instalado, execute `python data/referencias/reurb/carregar_dataframes.py`.

## Regra central

**Um projeto estratégico possui um único mapa lógico.** O MaPR e o MaInd são visões relacionadas desse mapa. As ações participantes entram por vínculo. Novas versões preservam o histórico no mesmo mapa, sem criar um mapa independente por ação, UO, programa ou ano.

Neste exemplo:

| Projeto | Mapa lógico | Programa PPO | UO | Ação |
| --- | --- | --- | --- | --- |
| 14 — Minas Reurb | mapa-minas-reurb | 0125 | 01221 | 1082 — Minas Reurb Sede |
| 14 — Minas Reurb | mapa-minas-reurb | 0125 | 02461 | 4528 — Minas Reurb ARMVA |

O programa 125 é mais amplo que o Reurb. Nenhuma outra ação do programa foi vinculada automaticamente. A Cohab é ator no relatório, mas estas duas ações PPO não autorizam inventar uma ação/código para ela.

O vínculo do mapa documental com o código de projeto 14 é uma **proposta de modelagem solicitada pelo usuário**. O relatório não identifica o mapa por esse código. Os vínculos entre as duas ações e o projeto 14, por sua vez, constam nos campos das exportações PPO.

## O que foi extraído

MaPR: 5 itens de contexto, 8 recursos, 5 atividades, 4 produtos, 7 resultados, 6 impactos e 2 pressupostos: **37 componentes**.

MaInd: 3 indicadores de recursos, 2 de atividades, 2 de produtos, 4 de resultados e 1 de impacto: **12 indicadores**.

Transcrição das imagens, com quebras de linha normalizadas. Mantidas as classificações originais, inclusive semelhanças entre produto e resultado sobre capacidade técnica municipal. Não foram incorporadas outras listas de fases ou números apurados em capítulos diferentes do relatório.

Cada componente e indicador tem ID interno, posição na coluna, figura, página impressa, página do PDF e fonte. Não recebeu código oficial PPO. O programa 125 não tinha indicadores oficiais na exportação examinada; os 12 indicadores aqui vêm do relatório de avaliação.

As figuras não apresentam arestas específicas entre todos os itens nem vínculos com os códigos de ação. Por isso:

- `relacoes_componentes`: 6 exemplos de ligações, todos com situação `sugestao_a_confirmar`.
- `indicador_componentes`: 11 exemplos de associação, todos com situação `sugestao_a_confirmar`.
- `componente_acoes`: vazio, com estrutura pronta. Não presume que toda ação execute todo o mapa.
- `componente_atores`: 8 vínculos de origem dos recursos explícitos nos rótulos; não atribui responsáveis pela medição dos indicadores.
- `medicoes`: vazio. Não foram inventados valores, fórmulas, metas, linhas de base ou séries históricas.

## Como abrir os dataframes

Descompacte o pacote e execute o Python em um ambiente com pandas:

```python
from carregar_dataframes import carregar_dataframes

dfs = carregar_dataframes()
df_componentes = dfs["componentes"]
df_recursos = dfs["recursos"]
df_atividades = dfs["atividades"]
df_produtos = dfs["produtos"]
df_resultados = dfs["resultados"]
df_impactos = dfs["impactos"]
df_indicadores = dfs["indicadores"]
```

Os JSON usam `orient="table"`: incluem esquema e preservam códigos textuais e colunas vazias. Para JavaScript/TypeScript, cada arquivo tem uma propriedade `data` com o array de registros e uma propriedade `schema`.

Este pacote fornece dados para análise e adaptação pelo Codex. Não é um pacote de backup do aplicativo atual e não deve ser passado diretamente ao comando de restaurar estado dos Espelhos.

## Tabelas principais e granularidade

| Dataframe | Uma linha representa | Chave |
| --- | --- | --- |
| projetos | Projeto estratégico lógico | projeto_id |
| acoes | Ação por programa/UO/código nesta base | acao_id |
| projeto_acoes | Participação da ação no projeto por exercício | projeto_id + acao_id + exercicio_referencia |
| mapas | Mapa lógico do projeto, dono do MaPR e MaInd | mapa_id; projeto_id único |
| versoes_mapa | Versão documental/de trabalho do mesmo mapa | versao_id |
| componentes | Contexto, recurso, atividade, produto, resultado, impacto ou pressuposto | componente_id |
| relacoes_componentes | Relação entre origem e destino no desenho | relacao_id |
| indicadores | Indicador do MaInd nesta versão | indicador_id |
| indicador_componentes | Associação de indicador a componente | indicador_id + componente_id |
| componente_acoes | Participação de uma ação em um componente | componente_id + acao_id |
| atores | Instituição ou grupo participante | ator_id |
| componente_atores | Papel de ator em um componente | componente_id + ator_id + papel |
| medicoes | Valor observado por período e recorte, futuramente | medicao_id |
| fontes | Documento/cadastro de origem | fonte_id |

As visões `contexto`, `recursos`, `atividades`, `produtos`, `resultados`, `impactos` e `pressupostos` são filtros derivados de componentes. Não são sete cadastros independentes.

## Exemplo de vínculo sem duplicar o mapa

```python
df_participacao = (
    dfs["mapas"]
    .merge(dfs["projeto_acoes"], on="projeto_id", validate="one_to_many")
    .merge(dfs["acoes"], on="acao_id", validate="many_to_one")
)

assert df_participacao["mapa_id"].nunique() == 1
assert df_participacao["acao_id"].nunique() == 2
```

Uma junção expande linhas para consulta; não cria cópias no cadastro de mapas. Não somar indicadores ou recursos novamente porque aparecem em várias linhas dessa consulta. Razões como gastos/beneficiários precisam de numerador e denominador compatíveis; sua agregação não deve somar ou tirar média simples de razões locais.

## Ajustes recomendados no frontend existente

Na versão analisada, `ProcessMap` pertence a `programId`, e `createPlanningInitial` cria um mapa por programa. Isso não representa corretamente um mapa exclusivo do Reurb quando o programa 125 contém outras frentes.

1. Criar cadastro de projetos estratégicos a partir de código/nome nas ações. Usar ID interno estável e preservar o código original. Se códigos/nomes forem conflitantes ou reutilizados em outro catálogo, exigir conferência antes de consolidar.
2. Dar ao mapa um `id` próprio e escopo explícito `programa` ou `projeto_estrategico`, com um único dono. Para projeto, garantir unicidade de `projetoId` no cadastro lógico de mapas.
3. Manter versões/revisões dentro do mesmo mapa. Ações e exercícios entram em vínculos, sem mudar a identidade lógica do mapa.
4. Vincular ao projeto 14 as duas ações declaradas nas fontes, mantendo seus programas e UOs. O acesso por qualquer uma delas deve resolver para `mapa-minas-reurb`.
5. Guardar os componentes no nível do mapa, com ligações opcionais muitos-para-muitos às ações e aos atores. Componentes compartilhados não devem ser copiados para cada ação. Editar a lista completa depende de responsabilidade definida para o projeto; a UO da ação não determina, sozinha, a coordenação do projeto.
6. No MaInd, separar nome/ficha técnica, vínculo a componentes e valores observados. Associação individual é confirmada pelo usuário e pode ser múltipla.
7. Na ficha do programa, listar seus projetos e permitir abrir seus mapas. Conservar mapas anteriores de programa em seu escopo original; não atribuir automaticamente o mapa inteiro do programa 125 ao Reurb.
8. Atualizar consultas que usam somente `map.programId` para consultar o `mapaId` selecionado, inclusive MaPR, componentes de indicadores, revisão, espelhos e persistência. Migrar estados anteriores preservando IDs e vínculos; não agrupar componentes somente por semelhança textual.
9. Acrescentar uma aba/visão “Indicadores” ao mapa único do projeto, com categorias da figura e vínculos aos componentes. O indicador oficial do programa continua em seu cadastro de origem; seu uso no projeto é uma associação explícita.

Verificações mínimas: abrir pelas ações 1082/1221 e 4528/2461 resolve para o mesmo mapa; editar componente compartilhado aparece nas duas entradas; nenhuma outra ação do programa 125 é incluída por suposição; novas ações do projeto podem ser vinculadas sem criar outro mapa; recarregar preserva a identidade e as relações.

Arquivos envolvidos na futura integração: `src/types/index.ts`, `src/types/planning.ts`, `planningDomain.ts`, `proposalDomain.ts`, `proposalEditing.ts`, `planningPersistence.ts`, `MapaProcessos.tsx`, `IntegratedMap.tsx`, `MapVisualizer.tsx`, `IndicatorsSection.tsx`, `PlanningReview.tsx`, `Espelho.tsx` e testes. Esta entrega acrescenta os dados e sua documentação ao repositório; a integração com as telas permanece pendente.

## Limites de interpretação a preservar

- Mapa e indicadores foram construídos em novembro de 2024, segundo o relatório, e publicados em 2025. As ações vinculadas são da carga PPO de referência 2026. Não atribuir automaticamente o exercício 2026 ao conteúdo histórico do mapa.
- O relatório diferencia títulos viabilizados, regularizados/registrados e emitidos. As duas ações PPO usam o mesmo produto, mas suas especificações são distintas e foram preservadas em `acoes`.
- A figura classifica capacidade técnica municipal em produto e resultado. Antes de operacionalizar indicadores, definir a diferença entre município capacitado e capacidade efetivamente ampliada, sem alterar a transcrição original.
- Arrecadação, empregos e satisfação podem ser acompanhados, mas sua variação isolada não demonstra efeito causal do Reurb. As fichas precisam definir população, território, período, fonte e método de apuração.
- A frase do pressuposto sobre título individual foi transcrita como hipótese do mapa. Não equivale a uma regra jurídica de obrigatoriedade de emissão para todos os beneficiários.

## Validação deste pacote

Foram conferidas as figuras visualmente, as contagens por tipo, as chaves primárias/estrangeiras, a unicidade do mapa do projeto, os dois vínculos PPO e a preservação de códigos com zeros à esquerda. Todos os JSON foram reabertos em pandas e comparados aos dataframes originais. Tabelas sem informação permanecem vazias e sugestões permanecem não confirmadas.
