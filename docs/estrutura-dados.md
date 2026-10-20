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

O registro genérico de novos projetos/processos transversais ainda requer evolução do modelo. O protótipo já usa o projeto como núcleo dos mapas do Reurb; isso não significa que todos os cadastros transversais propostos já estejam implementados.

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

O adaptador mantém o texto original da UO, o código reconciliado, a linha completa do seed e os pareceres/deliberações originais. A deliberação numérica COFIN não é convertida automaticamente em uma aprovação booleana.

O seed existente não informa exercício e não mantém todos os números físicos de linha da planilha. Esses dados permanecem desconhecidos. A posição no seed é preservada, sem fingir que equivale à linha física do Excel. O gerador foi preparado para registrar a linha em futuras regenerações.

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
