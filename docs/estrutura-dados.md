# Organização dos dados e regras de integridade

Atualização: 20/10/2026. Este documento descreve o protótipo e separa o que já foi implementado do desenho de banco proposto.

## Três famílias de origem

| Origem | Papel | Entrada preservada | Uso na aplicação |
|---|---|---|---|
| Planejamento PPO | Cadastro oficial de referência | Quatro TXT em data/raw/plan2026/ | Programas, ações, indicadores PPO, localizadores e classificações |
| Avaliação do Minas Reurb | Desenho e acompanhamento da política | JSON documentados em data/referencias/reurb/ | MaPR e mapa de indicadores do projeto 14 |
| OBZ | Detalhamento dos pedidos e custos declarados | Planilhas importadas e seed da Saúde | Base independente; vínculo ao planejamento somente após conferência |

Origem não define uma árvore obrigatória. Um item OBZ pode continuar sem ação correspondente. Um indicador pode existir antes de seu componente do MaPR. Um projeto pode reunir ações de programas e UOs diferentes.

## Objetos e identidades

| Objeto | Identidade e contexto | Relações |
|---|---|---|
| Programa | ID estável e código textual no exercício/edição | Ações, indicadores PPO, vínculos estratégicos |
| Ação | ID estável; correspondência por programa + UO + código, no exercício | Programa, produto e especificação próprios, localizadores |
| Projeto/política transversal | Identidade própria | Participações de ações; não recebe uma cópia por ação |
| Mapa do projeto | Um mapa lógico compartilhado no objeto do projeto | Componentes MaPR e fichas de indicadores em duas abas |
| Componente | ID estável, tipo e texto | Participação de ações e associações com indicadores são explícitas |
| Indicador do mapa | ID estável e ficha gerencial | Não vira indicador oficial PPO automaticamente |
| Localizador | Código textual mais contexto da ação/edição | Relações territoriais mantêm IBGE, Sigplan e região juntos |
| Item OBZ | ID estável, origem e exercício próprios | IDs de programa/ação podem ficar vazios; candidatos ficam separados |
| Lote OBZ | SHA-256 do arquivo e aba | Cada linha recebe identidade estável por lote, aba e linha |
| Proposta | Diferenças em relação ao original | Comparação, histórico e reversão sem alterar a fonte |

O exercício OBZ não é deduzido do arquivo, da ação encontrada ou da base PPO. Quando ausente na origem, pode ser informado explicitamente pelo usuário na proposta.

O comando Criar mapa do zero cadastra Demais projetos/processos nomeados ou um mapa geral do programa. Cada cadastro recebe identidades próprias de projeto e mapa, origem local, data de criação e uma lista explícita de ações participantes. As ações podem pertencer a programas e UOs diferentes. O programa responsável define a permissão de edição. Uma ação pode participar de vários projetos; os atalhos exibem todos eles.

Novos mapas usam o mesmo editor do Reurb, mas começam sem componentes ou indicadores. Apenas o mapa de referência do Reurb recebe o conteúdo da avaliação. A limpeza de uma aba preserva a outra e registra histórico. O editor anterior continua acessível para consultar ou editar o conteúdo já existente, sem convertê-lo silenciosamente.

O seletor global de UOs deriva exclusivamente do catálogo PPO, deduplicado pelo código sem zeros à esquerda. Opções antigas do protótipo não são agregadas. Os códigos 4741, 4441, 4451 e 1991 ficam fora desse seletor por solicitação do usuário; registros importados e vínculos existentes permanecem preservados. A identificação FAOP é 2171; a antiga opção fictícia FAOP 1481 não é reutilizada. Os arquivos de origem mantêm sua grafia para rastreabilidade.

## Tratamento da base de Saúde

A planilha 4291.xlsx contém registros de cinco unidades. O nome do arquivo e o agrupador FES/SES não substituem a UO declarada em cada linha.

| UO de origem | Código | Itens no seed |
|---|---:|---:|
| FES | 4291 | 342 |
| FUNED | 2261 | 296 |
| FHEMIG | 2271 | 465 |
| ESPMG | 1541 | 73 |
| HEMOMINAS | 2321 | 326 |
| Total | | 1.502 |

O adaptador mantém o texto original da UO, o código reconciliado, a linha completa do seed e os pareceres/deliberações originais. A deliberação numérica COFIN não é convertida automaticamente em uma aprovação booleana. Decisões antigas que podem ter sido inferidas pelo adaptador permanecem preservadas, mas exigem conferência; a tela não as apresenta como aprovação confirmada automaticamente.

O seed existente não informa exercício e não mantém todos os números físicos de linha da planilha. Esses dados permanecem desconhecidos. A posição no seed é preservada, sem fingir que equivale à linha física do Excel. O gerador foi preparado para registrar a linha, os cabeçalhos e as células em futuras regenerações, preservando números ausentes como nulos. Há teste de integração que o executa contra a planilha real em arquivo temporário, sem sobrescrever o seed ativo.

Exemplos fictícios da FAOP ficam em src/data/fixtures/faop.ts. Não integram o cadastro oficial, os itens ativos nem as opções de programa/ação. O exemplo não deve ser usado para decidir qual ação existe no PPO vigente.

## Reconciliação OBZ

1. Preservar arquivo, aba, lote, linha e células originais.
2. Ler separadamente UO, programa, ação, exercício e valores declarados.
3. Procurar candidatos por programa, UO e código da ação.
4. Confirmar apenas correspondência única no mesmo exercício.
5. Manter ausências, ambiguidades e outro exercício como pendências consultáveis.
6. Preservar as edições locais em uma reimportação do mesmo lote/linha.

A tela tem filtros para o programa selecionado, itens sem vínculo confirmado e toda a base OBZ. Assim, registros sem correspondência não desaparecem das consultas.

As classificações financeiras desconhecidas são exibidas como Não informado. Números vazios não viram preços, frequências ou totais fictícios. Zero declarado permanece zero. O total calculado fica separado da escolha de usar o total informado; abrir e salvar uma ficha não recalcula silenciosamente o pedido.

## Duplicação necessária e redundância indevida

- TXT originais e JSON compactado: fonte e artefato gerado; não são dois cadastros editáveis.
- Original e proposta: comparação e histórico; a fonte permanece protegida.
- Identificação de programa/ação na linha OBZ: evidência da origem; não substitui o vínculo ao cadastro oficial.
- Descrições em tabelas analíticas: projeções derivadas; evitar manter cópias independentes que possam divergir.
- Produto PPO e produtos do MaPR: objetos com papéis diferentes; associação é opcional e explícita.
- Indicadores PPO e indicadores da avaliação: origens e estatutos diferentes, mesmo quando nomes se parecem.
- Arquivos legados na raiz e modelos em bases_csv: não são a referência ativa do fluxo qualitativo. Sua remoção ou reorganização exige conferir consumidores; não alterar a fonte oficial por engano.

## Persistência e migração já implementadas

O protótipo continua usando localStorage, não Postgres.

- A chave fpo-state-v2 guarda diferenças em relação ao estado inicial.
- Antes da primeira migração de integridade OBZ, a cópia anterior é preservada em fpo-state-v2-before-obz-integrity.
- IDs dos 1.502 itens do seed são mantidos.
- Identificações antigas ficam no registro para conferência.
- A UO que o adaptador antigo atribuía indevidamente ao FES é recuperada da origem.
- Textos, valores e demais alterações locais são preservados.
- Associações antigas de coerência continuam existentes; ficam inconsistentes quando o vínculo do item exige revisão.
- A fonte original do seed não é repetida em cada diferença salva quando é idêntica ao estado inicial.
- Pacotes com identificadores duplicados não são consolidados silenciosamente.

A auditoria da revisão verifica identidades, ações sem programa, mapas duplicados, referências a componentes removidos e vínculos OBZ incompatíveis. Pendências opcionais são apresentadas separadamente dos erros de integridade.

## Desenho proposto para Postgres

Não é uma migração SQL já executada.

| Grupo | Tabelas sugeridas | Campos centrais |
|---|---|---|
| Origem | source_file, import_batch, source_row | hash, arquivo, aba, linha, conteúdo original, codificação |
| Referência | planning_edition, budget_unit, program_snapshot, action_snapshot | exercício, edição, IDs, códigos textuais e campos qualitativos |
| Território | localizer, localizer_territory | ação, localizador, IBGE, Sigplan, região e situações originais |
| Projetos | project, project_action | tipo estratégico/outro, nome, responsável e participações entre UOs |
| Mapas | project_map, map_version, map_component, component_action | projeto, versão, tipo de componente e participações |
| Indicadores | indicator_definition, indicator_component | origem, ficha técnica, etapa e vínculos sugeridos/confirmados |
| OBZ | obz_round, obz_item, obz_match | exercício próprio, UO de origem, valores declarados/calculados, candidatos e confirmação |
| Proposta | revision, revision_event | autor, data, original, proposta, motivo e operação |

Restrições importantes:

- IDs internos não dependem de nomes ou de códigos que podem ser corrigidos.
- Códigos são texto: zeros à esquerda são significativos na apresentação e na origem.
- Chaves estrangeiras opcionais permanecem nulas quando a relação não foi confirmada.
- Arquivo de origem e proposta não compartilham campos editáveis.
- Uma participação em várias ações não duplica o mapa nem distribui automaticamente custos.
- Agregações de custos precisam de critérios explícitos de rateio para evitar dupla contagem.
- Edições diferentes do mesmo exercício precisam de identidade própria.
- Metadados e evidências podem usar JSONB; identidades, exercícios, UOs e relações devem ter campos tipados.
