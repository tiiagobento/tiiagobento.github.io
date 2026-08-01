# Regras Tecnicas Steel Frame

## Objetivo

O catalogo tecnico transforma referencias aprovadas da Nova Forma em modelos
versionados e auditaveis. Ele nao substitui projeto estrutural, memoriais,
verificacao de cargas, validacao do responsavel tecnico ou ART.

O motor comercial continua calculando quantidades a partir de medidas e
parametros cadastrados. A camada tecnica apenas informa se a entrada esta dentro
de um modelo previamente aprovado, se ainda e preliminar ou se exige revisao.

## Fontes do modelo

Uma composicao liberada precisa combinar, conforme aplicavel:

1. normas tecnicas e suas versoes efetivamente consultadas;
2. composicao ou projeto aprovado pelo responsavel tecnico;
3. dados de fabricante para materiais e consumos;
4. regras internas de compra, perdas e arredondamento aprovadas pela empresa.

Regras praticas de levantamento, como uma preferencia de espacamento, nao sao
tratadas como exigencia normativa universal. Elas ficam registradas com origem,
fonte, versao, condicoes e limites explicitos.

## Tabelas

- `steel_frame_technical_rules`: regra versionada, fonte, parametros, limites,
  vigencia e aprovacao.
- `steel_frame_technical_compositions`: modelo tecnico selecionavel no
  orcamento, com perfil/especificacao, condicoes, limites e responsavel.
- `steel_frame_technical_composition_rules`: vinculo entre uma composicao e as
  regras que a sustentam.
- `steel_frame_technical_assessments`: historico append-only das validacoes de
  cada orcamento, com entradas, achados e snapshot das regras usadas.

As tabelas usam RLS. Quem tem permissao de consulta do catalogo ve apenas
artefatos aprovados; gestores do catalogo podem ver e criar rascunhos. Aprovacao
exige `estimates.approve` ou `estimates.manage_all`.

## Classificacao

O validador usa somente limites explicitamente cadastrados no modelo aprovado.

- `ORCAMENTO AUTOMATICO`: composicao e regras aprovadas, vigentes, geometria
  confirmada e todos os limites/condicoes atendidos.
- `ORCAMENTO PRELIMINAR`: falta uma composicao aprovada, vigencia, medida,
  confirmacao ou declaracao critica do modelo.
- `REVISAO TECNICA OBRIGATORIA`: um limite foi excedido, ha conflito de regras,
  uma condicao exige revisao ou a geometria esta inconsistente.

Uma classificacao automatica nao aprova a estrutura. Ela so registra que os
dados informados se encaixam no modelo tecnico aprovado selecionado.

## Cadastro seguro

1. Abra `/estimates/catalog/technical`.
2. Cadastre a regra como **rascunho**, incluindo origem, fonte, versao,
   responsavel tecnico, registro profissional, vigencia e JSON de limites.
3. Revise o documento tecnico/licenciado fora do CRM e aprove a regra.
4. Crie uma composicao em rascunho e vincule apenas regras ja aprovadas.
5. Informe perfil/especificacao, condicoes, limites, responsavel, registro e
   vigencia.
6. Aprove a composicao. Versoes aprovadas nao podem ser editadas; crie uma nova
   versao e marque a anterior como superada quando necessario.

Exemplos de chaves que o validador reconhece em `limits`:

```json
{
  "maxWallHeightMeters": 0,
  "maxFloors": 0,
  "allowedStudSpacingMeters": [],
  "maxOpeningWidthMeters": 0,
  "requiresWindValidation": false,
  "requiresRoofReview": false,
  "requiresTechnicalReview": false
}
```

Os valores acima sao apenas formato. Nao sao recomendacoes tecnicas e nao devem
ser copiados como limites reais. Preencha somente valores aprovados para aquela
composicao e sua vigencia.

## Aplicacao da migration

Execute `supabase/migrations/add_steel_frame_technical_rules.sql` somente depois
de `add_steel_frame_estimates.sql`. A migration e aditiva e nao apaga leads,
orcamentos, perfis, tarefas, interacoes ou arquivos.

Antes de liberar uso em producao, valide no Supabase que:

1. as quatro tabelas existem e estao com RLS habilitado;
2. um usuario apenas de consulta nao ve rascunhos;
3. um gestor cria rascunhos, mas nao consegue forjar a aprovacao sem permissao;
4. a conta tecnica consegue aprovar somente apos informar responsavel, registro
   e inicio da vigencia;
5. uma avaliacao e criada na ficha do orcamento e nao pode ser editada/deletada
   pelo cliente.

## Limites da IA

A IA pode extrair paredes, aberturas, medidas e evidencias para revisao humana.
Ela nao escolhe perfis estruturais, nao aprova modelos, nao cria limites
normativos e nao substitui revisao tecnica.
