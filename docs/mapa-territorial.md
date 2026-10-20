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
