# Motor de Quantitativos Steel Frame - Fase 1

## Objetivo e limite da fase

Esta fase cria um dominio deterministico para quantitativos de Steel Frame. O motor calcula necessidades tecnicas, compra, perdas, sobras e explicacoes sem acessar Supabase, sem publicar regras e sem alterar a interface existente.

Ele nao dimensiona estruturas, nao aprova uma solucao construtiva e nao substitui a revisao do responsavel tecnico.

## Arquitetura

O modulo esta isolado em `src/lib/steel-frame/engine`:

- `types.ts`: vocabulario do dominio e resultados tipados.
- `schemas.ts`: contratos Zod para paredes, aberturas, composicoes, regras e cortes.
- `units.ts`: conversoes explicitas e arredondamentos.
- `cutting-stock.ts`: otimizador unidimensional deterministico.
- `engine.ts`: despacho das estrategias e classificacao tecnica.
- `fixtures.ts`: comparacoes Rafa e Ana Paula.

A API publica existente em `src/lib/steel-frame/calculator.ts` nao foi alterada. O modulo novo e consumido separadamente por `src/lib/steel-frame/engine` nesta fase.

## Dominio

O motor representa:

- paredes e segmentos;
- encontros e cantos;
- aberturas e templates de reforco;
- pecas tecnicas, barras comerciais e sobras reutilizaveis;
- materiais, embalagens, composicoes e camadas;
- regras versionadas e fontes tecnicas;
- quantitativos, perdas, arredondamentos, planos de corte e explicacoes;
- alertas e classificacao tecnica.

Todos os valores geometricos da Fase 1 usam metros e metros quadrados no contexto de calculo. Conversoes de `mm`, `cm` e `m` passam somente por `units.ts`. Nao ha conversao implicita entre dimensoes ou entre unidades de compra, por exemplo de `board` para `package`.

Unidades suportadas: `mm`, `cm`, `m`, `m2`, `unit`, `piece`, `bar`, `board`, `package`, `roll`, `box`, `bag`, `kg` e `liter`.

## Estrategias executaveis

| Estrategia | Base de calculo | Compra |
| --- | --- | --- |
| `STUD_BY_SPACING` | paredes, espacamento, extremidades, encontros, aberturas e ajuste manual | barras e plano de corte |
| `TRACK_BY_WALL_LENGTH` | guia inferior, superior, abertura, bloqueador, verga, contraverga, encontro e adicional manual | barras e plano de corte |
| `BLOCKING_BY_STUD_PATTERN` | padrao alternado, todas as celulas, linhas fixas, intervalo vertical, quantidade fixa ou manual | barras e plano de corte |
| `BOARD_BY_AREA_COEFFICIENT` | area, faces, camadas, desconto configurado de vaos e cobertura | embalagens |
| `MEMBRANE_BY_AREA` | area, faces, camadas, sobreposicao e cobertura por rolo | rolos ou embalagens |
| `INSULATION_BY_AREA` | area, faces, camadas, cobertura por pacote e cavidade compativel | pacotes |
| `FASTENER_BY_AREA` | area e consumo por metro quadrado | caixas |
| `FASTENER_BY_BOARD` | quantidade declarada de placas e consumo por placa | caixas |
| `FIXED_PER_OPENING` | aberturas do escopo | embalagem configurada |
| `FIXED_PER_PROJECT` | quantidade de projetos do contexto | embalagem configurada |
| `MANUAL` | quantidade informada com justificativa | embalagem configurada |
| `CUTTING_STOCK_OPTIMIZATION` | pecas e barras informadas | plano de corte |
| `PACKAGING_ROUNDING` | necessidade tecnica declarada | arredondamento de embalagem |

`BOARD_BY_PANEL_LAYOUT` esta reservado para uma etapa futura. Ele nao e executado nesta fase.

## Regra, versao e fonte

Cada regra deve declarar:

- identificador, codigo, nome e versao;
- estrategia;
- status de aprovacao;
- fonte tecnica e versao da fonte;
- unidade tecnica, unidade de compra e unidades de entrada aceitas;
- perda, arredondamento, escopo e limites;
- parametros especificos da estrategia.

Os parametros sao schemas discriminados pelo campo `strategy`. O banco nunca armazena JavaScript, SQL ou formula livre para ser executada pelo motor.

Uma regra deve receber status `approved` e uma fonte tecnica registrada antes de um calculo poder retornar `automatic_eligible`.

## Pecas, compra e corte

Uma peca tecnica e diferente de uma unidade de compra. Por exemplo:

1. O motor lista quantidade e comprimento das pecas necessarias.
2. O otimizador distribui essas pecas em barras comerciais e sobras registradas.
3. O resultado informa barras compradas, perda de serra, sobra por barra, padroes de corte e sobras reutilizaveis.

O algoritmo expande as pecas, ordena por comprimento decrescente e usa o melhor encaixe deterministico. Empates sao resolvidos por comprimento, rotulo e identificador estavel. O kerf entra somente entre cortes da mesma barra. Nenhum corte pode ultrapassar o comprimento da barra atribuida.

O motor nao assume barras de 6 m, kerf, perda ou espacamento. Esses valores sao parametros da regra ou da composicao.

## Aberturas e reforcos

Portas e janelas podem ou nao ser descontadas da area conforme a regra:

- `do_not_deduct`
- `deduct_all`
- `deduct_above_area`

O template de reforco informa montantes adicionais, vergas, contravergas, guias, fixadores e perda de recorte. Um template nao aprovado continua calculavel somente como demonstracao e obriga `technical_review_required`. Uma abertura que exige reforco, mas nao possui template, bloqueia o calculo.

## Status tecnico

| Status | Significado |
| --- | --- |
| `automatic_eligible` | regra e composicao aprovadas, sem limites violados ou alertas bloqueantes |
| `preliminary` | faltam informacoes declaradas no contexto, mas ha uma estimativa utilizavel |
| `technical_review_required` | regra ou composicao nao aprovada, override manual, limite excedido ou compatibilidade pendente |
| `blocked` | entrada invalida, unidade declarada incorretamente, falta critica ou peca que nao cabe no estoque comercial |

O status mais restritivo sempre prevalece no lote de calculos.

## Como criar uma regra validada

1. Defina a estrategia e a unidade tecnica.
2. Informe a unidade de compra e a capacidade real da embalagem ou barra.
3. Informe somente parametros documentados por fonte tecnica.
4. Registre limites de altura e abertura quando aplicaveis.
5. Defina a fonte, a versao e o responsavel pela aprovacao.
6. Valide com o schema Zod e com testes de entrada conhecida.
7. Marque como `approved` somente apos revisao tecnica humana.

## Como criar uma composicao

Uma composicao possui camadas, cada uma com posicao, familia de material, faces, camadas, condicao e fonte. A Fase 1 ja carrega esse dominio para a regra poder verificar limite de altura e status de aprovacao. Publicacao, catalogo visual e selecao por IA permanecem fora do escopo.

## Como ler uma explicacao

Todo resultado contem:

- entradas de parede e vao;
- parametros usados;
- subtotais por origem;
- perda configurada;
- conversao para compra;
- regra e fonte em snapshot;
- alertas e classificacao tecnica.

O campo `explanation.text` e a versao legivel. Os campos estruturados podem alimentar interface, relatorio ou PDF em uma proxima fase.

## Fixtures de calibracao

### Rafa

O fixture registra apenas os parametros conhecidos do metodo pratico:

- espacamento de 0,40 m;
- altura de referencia de 3,00 m;
- barras comerciais de 6,00 m;
- arredondamento para cima;
- guia superior e inferior;
- bloqueadores;
- portas e janelas sem desconto de area.

Ele nao produz um total historico sem a lista real de paredes. Comprimentos, encontros, templates de abertura, padrao de bloqueadores e recortes continuam explicitamente pendentes.

### Ana Paula

O fixture guarda os quantitativos historicos informados: 34 montantes, 10 guias, 15 placas Glasroc, 20 placas drywall, 7 pacotes de la de rocha, 4 telhas sanduiche e 100 parafusos de telha. Ele compara esperado, calculado, diferenca e motivo; nunca ajusta a regra para forcar coincidencia.

## Limitacoes desta fase

Ainda nao existem:

- paginação grafica de chapas;
- importacao de ficha tecnica ou leitura de PDF;
- publicacao de regras no Supabase;
- IA multipass, overlays de planta ou processamento assincrono;
- calculo final de cobertura estrutural;
- eletrica, hidraulica, pintura ou piso.

Essas evolucoes devem reutilizar os schemas, o snapshot de regra, a classificacao tecnica e as explicacoes criadas aqui. Nenhuma regra nova deve executar formula livre ou liberar uma solucao estrutural sem aprovacao tecnica.
