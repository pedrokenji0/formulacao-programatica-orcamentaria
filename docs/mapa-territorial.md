# Mapa territorial de Minas Gerais

A aba Mapa territorial usa os 853 municípios do IBGE como referência comum. A malha simplificada fica versionada no projeto e é carregada do próprio site; a visualização não depende de chamadas externas ao IBGE nem de chaves de mapas.

## Objetos

- Município: código IBGE de sete dígitos, nome e geometria de referência. O código Sigplan é outra identificação e não é usado como substituto.
- Regionalização: identidade, nome, secretaria/órgão, UO responsável, ano de referência, fonte e regiões. Dentro de uma divisão, cada município pertence a uma região ou fica sem atribuição.
- Região: unidade pertencente a uma regionalização. Uma mesma cidade pode pertencer a regiões diferentes em divisões de secretarias diferentes.
- Série territorial: indicador, período, unidade, fonte, UO responsável e valores por código IBGE. O vínculo à ficha de indicador PPO ou de um projeto é opcional e explícito.
- Agregação: nenhuma por padrão; soma ou média simples dos municípios com dados quando escolhida pelo usuário. Taxas não recebem soma ou média ponderada automática.

Esses objetos não substituem os localizadores, metas físicas ou valores orçamentários. Uma ficha de indicador no MaPR ou PPO não é uma observação numérica municipal: o mapa só recebe números importados ou registrados explicitamente.

## Uso

1. Abra Planejamento qualitativo → Mapa territorial.
2. Consulte municípios, regiões intermediárias ou regiões imediatas do IBGE.
3. Para colorir por valores, importe CSV/XLSX com codigo_ibge e valor, informando nome/vínculo do indicador, período, unidade e fonte.
4. Para outra divisão, use Criar regionalização. Importe codigo_ibge e regiao ou cadastre regiões e selecione os municípios no editor.
5. Escolha a regionalização e o indicador/período. A visualização municipal preserva os valores originais; a regional informa sua regra e cobertura.
6. Exporte os valores em CSV ou os cadastros territoriais em JSON. O pacote completo da aplicação também inclui esses dados.

Ausência permanece sem dado, e zero é um valor. Códigos desconhecidos e municípios repetidos na importação são rejeitados. Uma planilha parcial é aceita; os outros municípios ficam sem valores ou sem região, conforme o cadastro.

O perfil Leitor consulta e exporta. O Gestor UA altera somente séries e regionalizações de sua UO. As mesmas regras são verificadas no domínio, além dos controles da interface. O protótipo continua persistindo no navegador; os cadastros ainda não são compartilhados por Postgres.

## Fonte e atualização

Fonte bruta: data/territorio/fonte-ibge.json, incluindo URLs, data de consulta e hashes SHA-256 das respostas. Catálogo: data/territorio/municipios.json. Malha de visualização: public/data/mg-municipios.json. O período da malha não é inventado a partir da data da consulta.

npm run generate:territory reconstrói os artefatos a partir da fonte já salva. npm run update:territory consulta as APIs oficiais, registra nova origem e regenera os arquivos. Revise as alterações antes de versionar.

A visualização usa projeção de Mercator, polígonos simplificados e arcos compartilhados para os limites das regiões. É uma ferramenta de planejamento e consulta, não uma base para delimitação cadastral.

## Desenho para Postgres

Mantenha municipio, malha_territorial/versao_malha, regionalizacao, regiao, regiao_municipio, serie_indicador e observacao_municipal como objetos separados. A observação deve ser única por série/período/município; a composição é única por regionalização/versão/município. A geometria pode futuramente usar PostGIS sem mudar os códigos IBGE ou os vínculos dos indicadores.

## Metas físicas e regionalizações de referência

As séries das ações 1082 (UO 1221) e 4528 (UO 2461), programa 125/projeto 14, vêm das colunas Previsão Física 2026–2029 da base de localizadores. São metas físicas previstas, com produto e unidade do cadastro da ação. Não são execução, resultado medido ou indicador oficial PPO cadastrado.

A ação 1082, em 2026, soma 17.166 unidades: 16.866 em localizador estadual e 300 em localizador da região intermediária de Montes Claros. Os quatro localizadores com município específico têm meta em branco. A ação 4528 possui 1.500 unidades por ano em localizador da região intermediária de Ipatinga. As séries preservam esses níveis, os localizadores e os registros de origem.

A cor na leitura regional representa a meta declarada para a região inteira, sem atribuir esse total a cada município. O resumo exibe separadamente a parcela estadual. Em regionalizações diferentes, como Saúde ou Ensino, não se redistribuem as metas regionais sem dados de desagregação. O CSV exporta as observações na granularidade original.

O anexo desta sessão não ficou acessível no ambiente. A referência de regionalizações foi obtida do acervo público FJP/IMRS, com exatamente o nome regionalizacoes-dos-municipios-de-minas-gerais.xlsx, edição 2026. O arquivo público consultado está registrado com URL, data e SHA-256 em fonte-regionalizacoes-fjp.json. Sua identidade binária não foi comparada com o anexo inacessível.

A referência contém 89 microrregiões e 16 macrorregiões de Saúde, 47 Superintendências Regionais de Ensino, cinco recortes metropolitanos/colares/RIDE e as divisões geográficas IBGE. Estas duas últimas coincidem por código com o catálogo instalado e são conciliadas sem duplicação. O recorte metropolitano/RIDE abrange 82 municípios; os demais não recebem um vínculo artificial.

Assistência Social e Segurança podem ser adicionadas como regionalizações independentes, sem alterar os municípios, os valores ou as divisões existentes. As referências FJP e PPO são consultáveis e exportáveis; cadastros locais continuam editáveis conforme perfil e UO.

npm run generate:territorial-references reconstrói as metas a partir dos TXT versionados e as regionalizações a partir da fonte FJP salva. npm run update:regionalizations atualiza a planilha pública e reconstrói os artefatos; as mudanças devem ser conferidas antes de versionar.

## Recursos orçamentários das ações do Reurb

O botão Recursos orçamentários, no próprio Mapa territorial, alterna a leitura para as previsões orçamentárias das ações 1082/UO 1221 e 4528/UO 2461. A seleção de ano cobre 2026–2029 e preserva a ação ao alternar entre recursos e metas físicas. Um painel compara os totais e a participação de cada ação no mesmo ano. São recursos previstos no planejamento, em reais nominais; não são despesas executadas.

Em 2026, os localizadores da ação 1082 somam R$ 48.281.208,00: R$ 47.501.208,00 em localizador estadual (98,38%) e R$ 780.000,00 na região intermediária de Montes Claros (1,62%). A ação 4528 tem R$ 16.545.637,00 na região intermediária de Ipatinga. O total das duas ações no ano é R$ 64.826.845,00.

A parcela estadual aparece separadamente. As parcelas regionais colorem a região inteira, sem rateio ou repetição como valor municipal. Localizadores municipais sem valor continuam sem dados. A tabela apresenta os localizadores, a abrangência original, o valor e a participação no total da ação. Quando o total é zero ou desconhecido, não se calcula percentual. Regionalizações de Saúde ou Ensino não recebem redistribuição das parcelas regionais da origem.

As oito séries orçamentárias são versionadas em data/territorio/recursos-reurb.json, separadas das oito séries físicas. O gerador scripts/territory-planning-targets.mjs lê as colunas Previsão Orçamentária dos mesmos TXT e confere os totais contra a ficha da ação nos testes. Mantêm-se exercício, programa, projeto, ação, UO, localizador e referência à linha de origem. As séries de referência são protegidas e não alteram as fichas qualitativas nem os cadastros de indicadores.

O CSV de recursos exporta a ação/ano selecionados na granularidade dos localizadores. A exportação de dados territoriais em JSON inclui as séries físicas e orçamentárias. npm run generate:territorial-references regenera ambas as referências, além das regionalizações FJP.

## Indicação de localizadores estaduais no mapa

Parcelas com valor positivo em localizador estadual recebem um aviso imediatamente acima da cartografia: valor, percentual da ação, ano e códigos dos localizadores. Uma hachura visível por padrão cobre o contorno de Minas Gerais. É uma camada categórica de abrangência, independente da escala de valores regionais/municipais, e pode ser ocultada sem remover o aviso ou o valor da legenda. A mesma leitura vale para recursos orçamentários e metas físicas.

A indicação também aparece na legenda, nos detalhes do município e no texto de consulta do mapa. O preenchimento estadual da base não permite concluir que todos os municípios serão atendidos. Nenhum valor municipal é calculado a partir dessa parcela. O cinza significa ausência de valor municipal/regional discriminado e não ausência de uma parcela estadual. A hachura continua abrangendo o estado inteiro ao destacar uma região; os valores regionais mantêm sua própria escala.

Em 2026, a ação 1082 destaca R$ 47.501.208,00 (98,38%) no localizador estadual V41991 e mantém R$ 780.000,00 separados na região de Montes Claros. A ação 4528, sem parcela estadual, não recebe a hachura. Anos com valor estadual zero tampouco a recebem.
