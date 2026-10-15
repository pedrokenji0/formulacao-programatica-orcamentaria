# Formulação Programática-Orçamentária — PPO-MG

Mockup em **React 18, TypeScript e Vite**, executado no navegador. A Programação Qualitativa aproveita o cadastro existente do PPO para construir uma proposta local, mantendo a referência importada para comparação. Backend, Postgres, autenticação e IA ficam fora desta entrega.

OBZ, coerência e espelhos continuam disponíveis. Valores orçamentários, previsões físicas e metas futuras não são importados para o novo fluxo qualitativo. Índice de referência dos indicadores e data de apuração são preservados.

## Instalação no Windows / PowerShell

Pré-requisitos: **Node.js 24 ou superior** e npm. Os testes de domínio usam o suporte nativo do Node a TypeScript. Os testes de interface no Windows usam o **Microsoft Edge** instalado.

Na pasta do repositório:

```powershell
npm.cmd ci
npm.cmd run generate:data
```

Não é necessário configurar banco ou credenciais.

## Geração reproduzível dos dados

Fontes preservadas em `data/raw/plan2026/`: `programas_planejamento.txt`, `acoes_planejamento.txt`, `indicadores_planejamento.txt` e `localizadores_Todos_planejamento.txt`.

O importador lê **Windows-1252**, separador **`|`**, campos vazios, acentos e textos longos. Suporta campos entre aspas, aspas escapadas e quebras de linha nesses campos. Quantidades inesperadas de colunas interrompem a geração, sem deslocamento silencioso dos dados.

```powershell
npm.cmd run generate:data
```

Esse comando executa `node scripts/planning-import.mjs --exercicio 2026`. O exercício **2026 é um parâmetro explícito desta carga**, identificado pelo conjunto fornecido `plan2026`; não é deduzido dos anos nas previsões. Para outra carga, confira a origem e ajuste o parâmetro.

A saída reproduzível é `public/data/planning.json.gz`. O manifesto registra exercício, codificação, delimitador, cabeçalhos, contagens e SHA-256 das fontes. Os TXT não são regravados. O navegador descompacta a referência com `DecompressionStream`; use uma versão atual do Edge, Chrome ou Firefox.

| Base | Linhas originais | Cadastros importados |
| --- | ---: | ---: |
| Programas | 2.553 | 182 programas |
| Ações | 1.046 | 1.044 combinações programa/UO/ação |
| Indicadores | 237 | 237 indicadores |
| Localizadores | 44.507 | 44.507 localizadores/relações territoriais |

Há duas combinações de ação com variantes divergentes: `705 / UO 2471 / 2417` e `705 / UO 2471 / 2500`. Todas são preservadas para consulta; a proposta começa pela primeira variante de origem. A revisão informa essas divergências.

- Códigos permanecem textuais e com a representação original. Zeros à esquerda são normalizados somente para associação.
- Programas repetidos são reunidos por código, mantendo as combinações de objetivo estratégico, diretriz e ODS.
- Ações usam programa + UO responsável + código da ação. Localizadores acrescentam seu próprio código a essa identidade, inclusive códigos como `X94661`.
- Cada relação territorial mantém município, IBGE, Sigplan e região juntos, sem combinações artificiais. Campos vazios e referências especiais não são preenchidos.
- Situações de programa, ação e localizador são independentes. `True/False` e `Sim/Não` são interpretados para apresentação, preservando o original.
- Vínculos ausentes e classificações divergentes geram avisos, sem substituição automática da ação.
- Indicadores oficiais sem código usam ID estável derivado de programa e nome; indicadores locais recebem UUID e indicação de origem.
- Previsões orçamentárias, físicas e de indicadores não integram o cadastro qualitativo. Seus cabeçalhos originais permanecem apenas no manifesto de origem.

## Desenvolvimento local

```powershell
npm.cmd run dev:local
```

Abra **http://127.0.0.1:5173/formulacao-programatica-orcamentaria/**.

O comando usa `127.0.0.1`, porta **5173** e `--strictPort`: se estiver ocupada, informa o erro sem trocar de porta.

## Build e preview local

Para gerar o build e iniciar o preview:

```powershell
npm.cmd run deploy:local
```

Abra **http://127.0.0.1:4173/formulacao-programatica-orcamentaria/**.

Ou execute separadamente:

```powershell
npm.cmd run build
npm.cmd run preview:local
```

O preview usa `127.0.0.1`, porta **4173** e `--strictPort`. Após editar código ou gerar dados, faça outro build para atualizar o preview. `deploy:local` não publica na internet.

A configuração `base: '/formulacao-programatica-orcamentaria/'` foi preservada para o GitHub Pages. Use as URLs completas, incluindo esse subcaminho.

Para encerrar o servidor, pressione **Ctrl+C no terminal que o iniciou**. Confirme o encerramento do arquivo em lotes caso solicitado pelo PowerShell. Se a porta estiver ocupada por outro servidor do projeto, encerre aquele terminal primeiro.

## Programação Qualitativa

Há quatro áreas independentes, além da visão geral do macroprocesso, acessíveis em qualquer ordem:

Programa e Ações e Entregas usam fichas completas com títulos e índice de seções, sem uma janela para cada grupo pequeno. **Indicadores** ficam numa aba do programa. Na ação, **Ficha da ação**, **Implementação e complementos** e **Localizadores e território** dividem o conteúdo. O espaçamento segue os HTML do PPO: campos legíveis, áreas de texto de no mínimo 100px, margens regulares e abas sublinhadas. Objetivo/justificativa e implementação ficam ao lado das causas em telas largas; responsabilidade e produto aproveitam colunas. Informações do gerente ficam em um grupo recolhível; justificativa de exclusão abre sob demanda. No MaPR, a cadeia permanece visível e cada bloco abre sua edição diretamente. Textos longos do mapa têm Ver mais/Ver menos; contexto e premissas podem ser ocultados.

O cabeçalho institucional do PPO foi preservado. A área de trabalho usa uma única faixa para programa ativo, exercício e estado de salvamento, sem repetir títulos e descrições do cadastro. Abas e comandos dividem a mesma faixa quando há largura disponível. Campos, tabelas e espaçamentos são compactos; textos longos continuam completos e as áreas de texto podem ser redimensionadas. Objetivo/justificativa e complementos usam colunas em telas largas e uma coluna no celular.

Orientações secundárias ficam nos botões **?**, acessíveis por mouse, foco do teclado e toque; **Esc** fecha a ajuda. Origem, situação e pendências são discretas, com detalhes sob demanda. Erros de salvamento e avisos de integridade relevantes continuam visíveis. A ação é selecionada diretamente num campo pesquisável; **Ver lista de ações** abre a tabela completa quando necessário. Nenhum desses ajustes modifica os dados ou as regras de persistência, reversão e exclusão.

1. **Programa:** identificação, responsabilidade, alinhamento estratégico, objetivo, justificativa, causas, estratégia de implementação, tipo, horizonte e situação cadastral. Indicadores ficam nesta área. Árvores, alternativas e envolvidos são ferramentas opcionais, inclusive para apoio administrativo e manutenção de serviços.
2. **Ações e Entregas:** cadastro, classificações, UO, unidade administrativa, finalidade, público, descrição, produto, especificação e base legal. Atividades, critério de entrega, evidência, parceiros e Detalhamento da Implementação são complementos locais. Localizadores ficam aqui, com filtros e detalhes.
3. **Mapa de Processos e Resultados:** organizar e visualizar no mesmo espaço. Produto e especificação alimentam referências de entrega. Objetivo e finalidade não são convertidos automaticamente em resultados ou impactos confirmados. Causas podem ser associadas explicitamente a atividades e produtos. Recursos e demais funções anteriores do mapa são preservados.
4. **Revisão do Planejamento:** comparação campo a campo, justificativas, indicadores locais, associações ao mapa, localizadores alterados e avisos. A revisão qualitativa pode ser exportada em JSON com referência e proposta.

A unidade global no topo continua sendo contexto dos módulos anteriores e delimita a edição para o perfil **Gestor UA**. A consulta das ações qualitativas não é filtrada: elas continuam identificadas por programa/UO/ação, com edição bloqueada fora do escopo desse perfil.

### Referências PPO e organização das fichas

Os HTML em `docs/referencias/ppo/` são documentação, não código da aplicação nem fontes de dados cadastrais. O conteúdo foi conferido: **`PPO-aba-acao.html` mostra a ficha Programa da Ação**, com identificação, responsabilidade, alinhamento estratégico, objetivo, justificativa, causas, horizonte, tipo e informações do gerente. **`PPO-aba-programa.html` mostra a aba Indicadores**, com tabela Código / Descrição do Indicador / Ações. Nenhum desses arquivos registra a ficha completa de ação; sua organização React segue os campos qualitativos exportados e os agrupamentos solicitados. As capturas mostram 2027, mas não mudam o exercício 2026 declarado na carga.

PPAG e exercício são metadados da referência, sem edição livre; PPAG fica vazio quando não foi informado na exportação. Valores de PPAG anteriormente preenchidos não são apagados: permanecem nos complementos legados e na comparação/exportação. Informações do Gerente permitem inclusão/edição dentro da ficha, sem inventar conteúdo ausente da base. Objetivo e Justificativa são apresentados como **Objetivo do Programa** e **Justificativa do Programa**, preservando suas chaves originais para comparação/exportação. Causas são itens editáveis com IDs preservados; o texto original permanece disponível. Todos os vínculos estratégicos são mantidos em tabela, com edição de cada combinação e inclusão/remoção explícita.

Classificações usam **um único campo de digitação com opções abaixo**, sem busca e dropdown separados. Digite código ou descrição e confirme uma sugestão com o mouse ou pelas setas e Enter; Esc cancela a busca. Digitar ou sair sem selecionar não altera o cadastro. O botão de limpar remove o par código/descrição inteiro. As opções vêm das bases, não de um catálogo oficial completo. Não se permite inventar classificações ou editar separadamente código e descrição. Produto e especificação continuam independentes. A seleção territorial mantém juntos região, município, IBGE e Sigplan de uma referência existente; não cruza linhas diferentes e somente é editável em localizadores locais.

### Implementação e complementos

A aba da ação reúne Detalhamento da Implementação e complementos opcionais. Acrescente quantas **etapas ou temas** fizerem sentido, com nome livre, descrição, responsáveis/parceiros, condições/dependências/riscos e entregas/evidências/acompanhamento. Os tópicos são complementos locais, não etapas oficiais ou associações automáticas ao mapa. Não há sequência obrigatória nem conteúdo pré-preenchido.

Atividades, critérios de entrega, parceiros e os esclarecimentos territoriais anteriores continuam disponíveis em grupos recolhíveis. Território é um dos temas possíveis, não o limite dos complementos de implementação. Etapas e complementos são salvos por ID, entram na revisão e são exportados com a proposta.

### Salvar, reverter e propor exclusão

Há **Salvar proposta** no início e no final das fichas, além do salvamento automático. Para cadastros importados, **Reverter para o original** pede confirmação e restaura somente a ficha escolhida, inclusive seus complementos locais. Outros cadastros, indicadores, localizadores e o conteúdo do MaPR permanecem preservados. Rascunhos sem referência não têm reversão para um original fictício.

**Propor exclusão** abre uma aba para programas e ações existentes, ou confirmação contextual em indicadores e localizadores. Programas, ações e indicadores cadastralmente não novos exigem justificativa; importados marcados como novos não exigem. Ausência do atributo de novidade é sinalizada; por decisão do mockup, solicita-se motivo nesse caso. **Restaurar na proposta** reativa um registro, sem desfazer as demais edições. **Descartar rascunho** remove somente um cadastro criado localmente, mantendo sua cópia no histórico; vínculos precisam ser resolvidos antes. Reversão, exclusão, restauração, descarte e mudança de vínculo têm histórico persistido e exportado. Nenhuma operação envia alterações ao PPO ou faz exclusão em cascata.

### Rascunhar programas e ações

Use **Rascunhar programa** no topo para abrir uma ficha inicialmente vazia. Na área Ações e Entregas, **Rascunhar ação** cria uma ficha dentro do programa ativo, importado ou local. A lista de ações permite pesquisar código, título e UO. Rascunhos incompletos são salvos; pendências são sinalizadas sem bloquear a retomada.

Novos cadastros recebem UUID interno estável e exibem **Sem código oficial** até o responsável preencher o código. Nome, código e UO podem ser preenchidos posteriormente sem recriar registros nem perder seus vínculos com ações, indicadores, localizadores e componentes do mapa. As fichas funcionam antes do MaPR; novas ações podem ser vinculadas depois em Gerenciar ações.

**Rascunho local** não equivale a Programa Novo, Nova Ação, exclusão lógica ou validação do PPO. Atributos cadastrais oficiais não são presumidos nem editados como texto livre. Indicadores complementares e localizadores também podem ser rascunhados, sem códigos presumidos. A Revisão mostra inclusões mesmo vazias, alterações e complementos; a exportação usa referência `null` para inclusões sem registro importado anterior.

A persistência v2 aceita os novos campos opcionais sem apagar estados anteriores. As permissões continuam simuladas: Consulta vê as mesmas fichas, mas não edita nem cria registros.

### Regras de edição

Veja a [matriz de regras e suas fontes](docs/regras-edicao.md). A política está centralizada em `editingPolicy.ts` e aplicada tanto nas fichas quanto nas atualizações do estado. As capturas são de consulta: seus atributos `disabled/readonly` não definem bloqueios gerais.

- Tipo de Ação importada é protegido; em rascunhos permanece editável mesmo depois do salvamento automático e da recarga. Tipo de Programa é editável.
- Códigos importados, origem, datas do sistema e demais metadados são protegidos. A referência é congelada em memória e não é modificada pela proposta.
- Mudanças de UO de cadastros existentes e de programa vinculado à ação são **solicitações separadas**, com associação anterior/pretendida e conferência de registros afetados. Não executam transferência neste mockup nem reassociam OBZ, território ou MaPR. Órgão da UO só vem de relação conhecida na base.
- Índice numérico pode ser zero ou decimal (ponto/vírgula); vazio não vira zero. **Em apuração** limpa o número vigente na proposta e verifica justificativa de pelo menos 60 caracteres, sem impedir salvamento incompleto. O valor importado continua na referência.
- Território importado é somente consulta. **Propor outro localizador** abre inclusão local por catálogo; o localizador anterior permanece preservado, com exclusão separada quando pertinente.
- **Revisão local** é independente da situação oficial. Editar conteúdo revisado o torna pendente; indicador afeta a revisão do programa e localizador a da ação. Comentários gerais da revisão são opcionais; a exigência de justificativa de exclusão não se estende a todos os campos.
- Perfis novos: Leitor, Gestor UA (UO selecionada), Gestor Setorial e Central Geral. Os perfis demonstrativos anteriores continuam disponíveis por compatibilidade. Não há autenticação real.

Propostas v2 anteriores a essas regras ganham cópia em `fpo-state-v2-before-editing-rules` antes da migração; textos anteriores não são apagados silenciosamente. A nova política regula alterações posteriores; divergências antigas continuam disponíveis para conferência.

### Edição da cadeia por ação

No mapa, cada ação tem até **8 linhas de recursos, 8 de atividades, 8 de resultados e 8 de impactos**. Produtos ficam em duas caixas: **um produto principal e até 7 produtos/entregas secundárias** (8 no total). O produto PPO preexistente aparece inicialmente na caixa principal como referência; essa organização é local e não altera sua classificação oficial. Todos os IDs e textos anteriores são preservados, inclusive estados antigos acima dos novos limites (novas inclusões ficam bloqueadas até haver espaço).

Clique em Editar/Adicionar no bloco para abrir a janela. Cada linha de recurso permite selecionar várias atividades da **mesma ação/UO**; cada atividade permite selecionar vários produtos/entregas. Nada é vinculado automaticamente. Esses vínculos podem ser feitos antes ou depois de completar os demais blocos e são salvos com a proposta. Ao remover uma linha, seus vínculos internos no mapa são removidos; indicadores que a acompanhavam mantêm a referência e geram aviso para revisão.

Resultados e impactos novos pertencem à ação selecionada. Registros antigos no âmbito do programa continuam em um bloco compartilhado separado, sem replicação nas ações. Ambos podem ser associados aos indicadores e exportados na revisão.

**Referências do PPO, Gerenciar ações e Validar desenho** são atalhos destacados acima da cadeia. **Tabelas de apoio** fica no canto superior direito, somente para o perfil **Administrador**, com uma aba de subcategorias e públicos-alvo. O perfil pode ser trocado no seletor do topo; esta é uma permissão simulada no frontend, não autenticação de produção.

### Indicadores e território

Indicadores preservam fórmula, fonte, periodicidade, unidade, base geográfica, polaridade, índice de referência, data, situação em apuração e justificativa. A associação a recurso, atividade, produto, resultado ou impacto é opcional e confirmada pelo usuário. O cadastro funciona antes do mapa; indicadores gerenciais locais são identificados separadamente.

Localizadores são um cadastro territorial sem previsões orçamentárias ou físicas. O município cadastrado não demonstra, sozinho, toda a população beneficiada. Distribuição territorial, papel do local registrado, critérios e condições/parcerias podem ser acrescentados localmente e incorporados ao Detalhamento da Implementação.

### Demonstração

Em um estado novo, o programa **125** abre por padrão. A **ação 1082 / UO 1221 — Sede** e a **ação 4528 / UO 2461 — ARMVA** se vinculam ao projeto estratégico **14 — Minas Reurb**. Suas especificações de produto permanecem distintas. O programa contém outras frentes, que não são atribuídas ao Reurb.

Não há indicadores oficiais do programa 125 na exportação fornecida: a tela informa a ausência e permite cadastro complementar local. O programa **1 — Minas Íntegra e Transparente** demonstra indicadores importados, índice de referência e data.

## Persistência e migração

A referência fica no arquivo estático. A proposta é salva em `localStorage`, chave **`fpo-state-v2`**, como diferenças em relação à base. Os 44 mil localizadores não são duplicados no armazenamento: somente suas propostas alteradas são salvas.

Estados `fpo-state-v1` são migrados mantendo a chave original. Novos campos vêm da referência atual; alterações anteriores são aproveitadas e vínculos sem correspondência inequívoca permanecem separados e sinalizados. Um v2 incompatível é copiado para uma chave de backup antes de iniciar outra proposta. Mudanças de versão da base geram aviso de conferência.

O estado de salvamento aparece na tela. Falhas, inclusive limite de armazenamento, são informadas; exporte um pacote completo para guardar o trabalho nesses casos. Recarregar recupera alterações, justificativas, indicadores e associações.

O pacote completo JSON nos Espelhos continua sendo o mecanismo de backup/restauração. O CSV OBZ conserva seu alcance anterior e não substitui esse backup. A exportação **Revisão qualitativa** serve para comparação, não para restauração integral.

Perfis e permissões são simulados. Nenhuma edição é transmitida ao PPO.

## Verificações

```powershell
npm.cmd run typecheck
npm.cmd run test:planning
npm.cmd run build
npm.cmd run test:e2e
```

Testes de domínio verificam bases completas, vínculos estratégicos, UOs, Reurb, indicadores, território, situações, IDs, ausência de previsões, migração e persistência. Também verificam rascunhos incompletos e preenchimento posterior de código/UO sem perder vínculos. Testes Playwright usam Edge headless com armazenamento isolado do navegador pessoal; verificam fichas completas, causas, pesquisa, inclusões, comparação/exportação sem referência fictícia, recarga, modo Consulta, indicadores, mapa e layout estreito. Fazem preview automaticamente se não houver servidor na URL; gere o build antes. Capturas e relatórios ficam em `test-results/`, ignorado pelo Git.

## Estrutura

```text
data/raw/plan2026/                  fontes originais preservadas
scripts/planning-import.mjs        geração e validação dos vínculos
scripts/planning.test.mjs          testes de domínio e persistência
public/data/planning.json.gz       referência gerada e compactada
src/types/planning.ts              modelos de indicadores e território
src/services/planningDomain.ts     domínio e montagem do estado
src/services/proposalDomain.ts     rascunhos e atualização de vínculos estáveis
src/services/planningPersistence.ts migração e armazenamento diferencial
src/components/ProposalForm.tsx    seções, índice e classificações vinculadas
docs/referencias/ppo/              capturas HTML do PPO (somente documentação)
src/pages/Qualitative.tsx          navegação entre as quatro áreas
src/pages/qualitative/             programa, ações, revisão e seções integradas
tests/qualitative.spec.ts          testes no navegador
```

O seed antigo de saúde permanece para compatibilidade com a demonstração OBZ. O novo cadastro qualitativo usa as quatro exportações completas. Recursos administrativos ilustrativos anteriores, como importação JSON de tabelas e histórico, continuam com as limitações preexistentes.
