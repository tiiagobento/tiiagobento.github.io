# Orcamentos Steel Frame

## Estado atual

O modulo tem uma fundacao segura e auditavel e uma interface operacional que combina IA, motor tipado e revisao humana:

- lista de orcamentos, criacao a partir de um lead ou manual e ficha de geometria;
- catalogo de materiais com preco inicial cadastrado por permissao;
- itens calculados pelo motor tipado com regra aprovada, explicacao e plano de corte, mantendo o calculo manual como contingencia;
- edicao e arquivamento auditavel de materiais, mao de obra e custos operacionais, sem exclusao do historico;
- custo direto, preco minimo, preco recomendado e desconto maximo derivados somente dos dados salvos;
- upload privado de plantas, croquis, fotos e PDFs, com URL assinada curta para abertura;
- analise documental pelo Gemini, com rascunho editavel, confianca/evidencia por item, modo de revisar somente pendencias, vinculo de abertura a parede e correcao humana auditada;
- aprovacao tecnica atomica que registra a decisao e congela a versao corrente;
- proposta comercial em PDF vetorial, calculada somente a partir dos custos e percentuais persistidos e vinculada a versao tecnica aprovada;
- navegacao por permissao e mensagens acionaveis quando a migration ainda nao estiver aplicada.

A migration continua deliberadamente manual: a aplicacao nao cria tabelas, buckets ou policies em um projeto Supabase sem autorizacao. A sincronizacao offline especifica de orcamentos continua em fase posterior.

## Aplicacao segura da migration

Antes de aplicar, mantenha a ordem abaixo no SQL Editor ou no Supabase CLI:

1. `supabase/schema.sql`
2. `supabase/migrations/add_partner_briefing.sql`
3. `supabase/migrations/add_partner_notifications.sql`
4. `supabase/migrations/add_access_control.sql`
5. `supabase/migrations/add_push_notifications.sql`
6. `supabase/migrations/ensure_primary_admin.sql`
7. `supabase/migrations/add_partner_commissions_and_lead_files.sql`
8. `supabase/migrations/add_permission_audit_details.sql`
9. `supabase/migrations/add_steel_frame_estimates.sql`
10. `supabase/migrations/add_steel_frame_technical_rules.sql`
11. `supabase/migrations/20260801000000_steel_frame_phase_2_catalog_foundation.sql`
12. `supabase/migrations/20260802000000_steel_frame_supplier_quote_history.sql`
13. `supabase/migrations/20260803000000_steel_frame_cost_item_lifecycle.sql`

A migration e aditiva e idempotente. Ela nao apaga leads, perfis, tarefas, interacoes ou arquivos existentes. Em especial, a relacao de um orcamento com um lead usa `ON DELETE SET NULL`, preservando o historico de precificacao caso um lead seja removido depois.

## Dominio criado

- `steel_frame_estimates` e `steel_frame_estimate_versions` para rascunhos, revisoes e congelamento de versoes aprovadas.
- `steel_frame_documents` e o bucket privado `steel-frame-documents` para plantas, croquis, fotos e PDFs de referencia.
- Jobs, extracoes, perguntas e correcoes de IA com confianca, evidencia, pagina e area de origem.
- Segmentos de parede e aberturas para calculo explicavel de area bruta, abatimentos e area liquida.
- Fornecedores, materiais, precos, composicoes e reforcos com parametros configuraveis.
- Itens calculados, mao de obra, custos operacionais e componentes comerciais.
- Aprovacoes e trilha de auditoria por orcamento/versao.

## Seguranca e permissoes

Todas as tabelas novas usam RLS. O acesso e determinado por `auth.uid()` e pelas permissoes existentes do CRM:

- Administradores com `estimates.manage_all` veem e administram toda a carteira.
- Usuarios comerciais recebem acesso aos proprios orcamentos, ao catalogo e aos dados financeiros que precisam para trabalhar.
- Revisores tecnicos precisam de permissao explicita e atribuicao em `technical_responsible_id`.
- Parceiros nao recebem permissao padrao para ver orcamentos ou financeiros. Um administrador pode conceder `estimates.view_assigned` de forma individual quando o acesso for realmente necessario; custos, margem e precos continuam protegidos por `estimates.financials.view`.

Versoes aprovadas ou congeladas nao podem ser alteradas. Alteracoes em rascunhos de orcamento e versao entram em `steel_frame_audit_logs`.

Itens de custo de uma versao editavel podem ser corrigidos ou arquivados. O arquivamento exige motivo, registra autor e data, remove o item somente do custo ativo e preserva a linha original para auditoria. Ajustes manuais em materiais preservam o calculo anterior em `source_data`, exigem justificativa e retornam o item para confirmacao tecnica.

Uma unica excecao controlada e o PDF de proposta: ele so pode ser anexado como documento `proposal` com visibilidade `internal`, pela propria conta que possui permissoes de financeiros e de geracao de proposta. O arquivo continua no bucket privado, fica associado a versao tecnica corrente e a mudanca para `proposal_generated` ocorre pela RPC `mark_steel_frame_proposal_generated`, que tambem registra auditoria. Parceiros sem permissao financeira nao conseguem listar, abrir ou baixar esse PDF.

## Motor deterministico

O motor tipado em `src/lib/steel-frame/engine/` nao embute regras tecnicas, precos ou espessuras de Steel Frame. A ficha do orcamento lista somente regras com status `approved`, valida o contrato Zod, converte a geometria confirmada em contexto mensuravel e preserva no item salvo a regra, fonte, versao, explicacao, alertas e plano de corte. Regras bloqueadas nunca podem ser adicionadas ao custo.

Para o vinculo automatico entre regra e material, use em `steel_frame_materials.technical_specification` uma das chaves abaixo:

- `technical_rule_id` com o ID da regra;
- `technical_rule_code` com o codigo versionado da regra;
- `strategy_type` com a estrategia do motor.

Quando nao houver correspondencia unica, o usuario escolhe o material no proprio painel. O preco precisa estar vigente; o sistema nao inventa preco nem coeficiente. O calculador anterior em `src/lib/steel-frame/calculator.ts` permanece disponivel para itens manuais e contingencias identificadas.

Regras aceitas:

- `STUD_BY_SPACING`
- `TRACK_BY_LINEAR_LENGTH`
- `BOARD_BY_AREA`
- `ROLL_BY_COVERAGE`
- `PACKAGE_BY_COVERAGE`
- `FASTENER_BY_AREA`
- `FASTENER_BY_BOARD`
- `FASTENER_BY_STUD`
- `FIXED_PER_OPENING`
- `FIXED_PER_PROJECT`
- `LINEAR_BY_OPENING`
- `MANUAL`

Se um parametro obrigatorio estiver ausente, o calculo falha de forma explicita. A interface futura deve pedir confirmacao ao usuario ou encaminhar a revisao tecnica, em vez de supor uma medida.

## Regras tecnicas versionadas

Depois de aplicar `add_steel_frame_technical_rules.sql`, a ficha do orcamento
tambem passa a registrar uma classificacao tecnica auditavel. Ela usa regras e
composicoes aprovadas, com fonte, versao, vigencia e responsavel tecnico, e
classifica o resultado como `ORCAMENTO AUTOMATICO`, `ORCAMENTO PRELIMINAR` ou
`REVISAO TECNICA OBRIGATORIA`.

Nenhum espacamento, perfil, carga ou limite normativo e fixado no codigo. A
classificacao automatica apenas confirma que dados ja revisados se enquadram em
um modelo aprovado; nao substitui projeto estrutural nem ART. Leia
`docs/STEEL_FRAME_TECHNICAL_RULES.md` antes de cadastrar ou aprovar um modelo.

## Preco comercial

O motor separa custo direto, reserva, impostos/comissoes sobre venda, margem e desconto permitido. O calculo retorna preco minimo, preco recomendado e teto de desconto sem reduzir o valor abaixo do minimo. Os percentuais devem vir da configuracao comercial autorizada; nenhum percentual de obra esta fixado no codigo.

## Documentos e IA

O bucket `steel-frame-documents` e privado. O navegador grava primeiro o metadado do documento, depois faz o upload no caminho `<usuario>/<orcamento>/<arquivo>` exigido pela policy, e remove esse metadado se o upload falhar. Aberturas usam URLs assinadas de curta duracao.

A rota `POST /api/ai/extract-estimate` recebe apenas IDs de documentos ja autorizados. No servidor ela resolve os objetos pelo cliente Supabase da sessao, baixa os bytes em memoria e chama o provider configurado. Para documentos, o fluxo aceita somente `gemini` (ou `mock` no desenvolvimento), pois PDFs, plantas e imagens sao enviados como `inlineData` para um provider multimodal. A chave de IA nunca vai ao navegador.

O resultado e validado por Zod, armazenado como uma extracao pendente de confirmacao e apresentado como campos editaveis. A revisao mostra confianca, documento, pagina e trecho de evidencia. Quando a IA informa `wall_label`, a abertura e vinculada a parede revisada ou a uma parede ja salva; vinculos incertos continuam como `A confirmar`. Somente o clique explicito em `Adicionar itens revisados` grava paredes e aberturas. A evidencia segue em `source_data` e qualquer diferenca entre a sugestao e o valor confirmado gera uma entrada em `steel_frame_ai_corrections`.

## Proximas fases

1. Edicao/arquivamento de fornecedores, precos historicos, composicoes e reforcos.
2. Criacao guiada de uma nova versao quando uma proposta congelada precisar de revisao.
3. Sincronizacao offline de rascunhos e testes ponta a ponta autenticados.
