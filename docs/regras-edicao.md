# Regras de edição qualitativa

Os números de página abaixo e os enunciados do manual são os fornecidos nos requisitos desta entrega. O manual integral em PDF não está no repositório; não houve confirmação independente dessas páginas. Os dois HTML em `referencias/ppo` foram inspecionados e são telas de consulta. Não se infere bloqueio permanente a partir de `disabled` ou `readonly` dessas capturas.

## Contextos

| Contexto | Regra | Fonte |
| --- | --- | --- |
| Referência importada | Preservada, congelada em memória, consultável e comparável | decisão do mockup |
| Proposta de alteração | Campos autorizados editáveis; IDs e metadados protegidos | decisão do mockup |
| Rascunho local | Preenchimento progressivo, campos incompletos e código vazio aceitos; não equivale a novidade oficial | decisão do mockup |
| Consulta / Leitor | Consulta e exportação, sem mutações nas funções de edição e no limite do estado | expressa no manual (Leitor); decisão do mockup (alias Consulta) |

## Matriz de campos e operações

| Campo / operação | Implementação | Fonte |
| --- | --- | --- |
| ID interno | Gerado uma vez; não depende de nome, UO ou código posteriormente informado | decisão do mockup |
| Código oficial importado | Somente leitura, inclusive alfanuméricos; ausência não é preenchida | decisão do mockup |
| Código informado de rascunho | Opcional e editável, sem transformar o rascunho em cadastro oficial | decisão do mockup |
| Código/descrição de classificação | Seleção conjunta de uma combinação conhecida na base; limpar remove o par completo | decisão do mockup |
| Dependências entre classificações | Não são deduzidas; os catálogos parciais não são apresentados como catálogo oficial completo | decisão do mockup |
| Órgão da UO | Relação conhecida nos programas importados; se não encontrada ou ambígua, não se preenche por inferência sobre dígitos | decisão do mockup |
| PPAG, exercício, momento, validação oficial, origem e datas do sistema | Consulta; PPAG ausente fica vazio. Valores legados ficam preservados para comparação/exportação | decisão do mockup |
| Exercício pretendido | Se introduzido, deve ficar separado do exercício da referência; não há necessidade de preenchê-lo neste fluxo | decisão do mockup |
| Nome, UA, objetivo, justificativa, estratégia do programa | Editáveis na proposta e no rascunho | decisão do mockup |
| Causas | Inclusão, edição e remoção; edição preserva ID e vínculos já feitos no mapa | expressa no manual, p. 31; decisão do mockup (IDs locais) |
| Gerente | Inclusão e edição na ficha, grupo recolhível; campos ausentes da base identificados como complementos locais | expressa no manual, p. 32; observada em tela (HTML Programa da Ação) |
| Tipo de Programa e Horizonte Temporal | Editáveis por catálogo, sem aplicar a restrição de Tipo de Ação | decisão do mockup |
| Área temática, objetivos estratégicos, diretrizes e ODS | Editáveis; combinações múltiplas preservadas, com inclusão/remoção explícita | observada em tela (agrupamento); decisão do mockup (edição na proposta) |
| UO de programa/ação existente | Solicitação separada, com original, destino pretendido, motivo e registros afetados | decisão do mockup |
| Programa vinculado à ação | Solicitação separada, sem mover a ação ou seus registros associados | decisão do mockup |
| Tipo de Ação existente | Bloqueado mesmo se o atributo oficial Nova Ação for positivo | expressa no manual, p. 16 (ação existente); decisão do mockup (distinção entre rascunho local e novidade oficial) |
| Tipo de Ação em rascunho local | Escolha e revisão permitidas após digitação, salvamento automático e recarga; não existe conclusão de cadastro inicial no mockup | expressa no manual, p. 16; decisão do mockup (autosave não conclui cadastro oficial) |
| Ação padronizada | Não produz bloqueio geral da ficha | expressa no manual, p. 19 |
| Título, UA, finalidade, descrição, público-alvo, base legal | Editáveis, com seleção de público-alvo por referência conhecida | decisão do mockup |
| Produto e especificação | Produto por catálogo; especificação textual própria da ação, não substituída ao trocar produto | decisão do mockup |
| Detalhamento da Implementação e etapas/complementos locais | Editáveis, sem inventar conteúdo importado | decisão do mockup |
| Atributos cadastrais do indicador | Nome, unidade, fórmula, fonte, periodicidade, base geográfica, polaridade, índice, data de apuração e justificativas editáveis; novidade/data do sistema só consultadas | decisão do mockup |
| Índice informado | Número decimal, inclusive zero; vazio permanece vazio; entrada inválida gera pendência, sem bloquear rascunho | expressa no manual, p. 37; decisão do mockup (checagem não bloqueante) |
| Índice Em apuração | Limpa o número vigente na proposta e solicita justificativa; original preservado na referência | expressa no manual, p. 37; decisão do mockup (limpeza e comparação) |
| Justificativa Em apuração | Mínimo de 60 caracteres na checagem de pendências, sem bloquear salvamento | observada em tela, p. 38; decisão do mockup (rascunho incompleto) |
| Indicador–MaPR | Associação local explicitamente selecionada; funciona sem mapa; não classifica como resultado automaticamente | decisão do mockup |
| Município e região importados | Consulta; a tela de edição citada não documenta troca territorial livre | observada em tela, p. 26 |
| Mudança territorial | Inclusão de outro localizador por catálogo, eventual exclusão do anterior em operação separada. Referências especiais preservadas | decisão do mockup |
| Dados físicos/orçamentários de localizador | Exigência oficial não bloqueia o rascunho territorial; valores fora do fluxo qualitativo | expressa no manual (exigência no PPO); decisão do mockup (escopo) |
| Exclusão de programa/ação/indicador não novo | Operação específica com motivo obrigatório | expressa no manual |
| Exclusão de importado cadastralmente novo | Não solicita motivo; usa atributo de novidade, não a origem importada | expressa no manual |
| Novidade não informada | Sinaliza pendência; exige motivo por precaução local, sem inventar atributo cadastral | decisão do mockup |
| Exclusão de localizador | Operação específica, sem propagar situação da ação/programa; motivo não obrigatório | decisão do mockup |
| Restaurar excluído na proposta | Operação com histórico; reativa sem apagar as outras edições | decisão do mockup |
| Descartar rascunho | Só origem local, com cópia no histórico; bloqueado se houver vínculos a resolver | decisão do mockup |
| Reverter para referência | Restaura somente a ficha e seus complementos, sem apagar indicadores, localizadores ou MaPR; mantém histórico | decisão do mockup |

## Permissões e revisão

- **Expressa no manual:** Leitor consulta; Gestor UA atua em sua UO; Gestor Setorial auxilia/orienta; Central Geral administra. Alterações desvalidam programa/ação; indicador também desvalida o programa (confirmação p. 38).
- **Decisão do mockup:** perfis são simulados no seletor, não uma barreira de segurança de backend. Gestor UA é limitado pela UO selecionada; Gestor Setorial edita transversalmente, pois não há matriz setorial na base. Central Geral administra. Consulta/Administrador são aliases demonstrativos; Técnico e Validador mantêm suas permissões anteriores. DCMEFO conserva o fluxo anterior sem receber edição qualitativa geral.
- **Decisão do mockup:** atributos de validação oficial são informação histórica, nunca validação realizada por esta ferramenta. Há estado separado `pendente`/`revisado` da revisão local. Alterações posteriores tornam a revisão pendente; indicador afeta programa, localizador afeta ação. O momento importado não bloqueia rascunhos.
- **Decisão do mockup:** a responsabilidade de um cadastro existente não é transferida nesta entrega. O comando registra uma solicitação para análise, mostra os vínculos encontrados e mantém as associações efetivas. Não há aceite/aplicação de transferência nem serviço de integração com o PPO.
- **Decisão do mockup:** pendências identificam a origem da exigência e não impedem salvar. A justificativa de uma alteração textual é opcional; a exigência de exclusão não se aplica genericamente aos outros campos.

## Implementação e persistência

`src/services/editingPolicy.ts` centraliza campos, contextos, permissões por UO, classificações, novidade e pendências. `proposalDomain.ts` aplica a política nas funções de atualização. `proposalEditing.ts` fornece operações específicas e verifica transações do `AppStore`, inclusive escritas realizadas fora das fichas. Funções de baixo nível de importação/migração não representam autorização para editar pela interface.

A persistência continua na chave v2, com campos opcionais versionados (`editingVersion: 1`). Antes de carregar um v2 anterior às regras, preserva cópia em `fpo-state-v2-before-editing-rules`. Alterações antigas não são apagadas para se adequarem retroativamente à política; devem ser conferidas na revisão. A referência atual permanece intacta. Histórico, solicitações de vínculo, pendências derivadas e revisão local sobrevivem à recarga; histórico e vínculos entram nas exportações.
