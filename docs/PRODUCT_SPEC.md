# Nova Forma CRM - Product Spec

## Preencher Lead com IA usando Puter.js

A rota `/leads/ai-import` permite que o usuario cole uma conversa ou envie prints de WhatsApp/Google Meu Negocio para gerar um rascunho de lead com IA.

### Fluxo

1. O usuario informa a origem do lead, cola a conversa e/ou seleciona imagens.
2. A chamada para IA acontece somente no clique em `Analisar conversa`.
3. O componente carrega `https://js.puter.com/v2/` apenas nessa tela e usa `puter.ai.chat()` com o modelo `gpt-5.4-nano`.
4. Prints locais sao convertidos em data URL com `FileReader.readAsDataURL` antes da chamada ao Puter.
5. A resposta da IA deve ser JSON valido, e o app tenta extrair um bloco JSON caso venha texto adicional.
6. O JSON e validado com Zod antes de renderizar os cards editaveis.
7. O usuario revisa todos os campos, resumo e avisos antes de salvar.
8. Leads so sao salvos quando o usuario clica em `Salvar lead` ou `Salvar todos os leads`.

### Regras de seguranca e UX

- A IA nao salva lead automaticamente.
- Imagens brutas nao sao salvas no banco.
- O limite e de 10 imagens e 20.000 caracteres de texto.
- Sao aceitas apenas imagens PNG, JPG, JPEG e WEBP.
- Nao e permitido analisar quando nao ha texto nem imagem.
- A revisao acontece em cards editaveis, sem salvar automaticamente.
- O salvamento reutiliza `saveLead`, mantendo sanitizacao de telefone, calculo de score e persistencia real no Supabase.
- A tela mostra aviso claro para revisao humana antes de salvar.
- Puter.js roda somente no client-side; nao ha API Route nem Server Component chamando `window.puter`.

### Campos extraidos

O rascunho tenta preencher dados de contato, origem, status, prioridade, cidade, bairro, tipo de obra, interesse, terreno, planta, urgencia, observacoes, proximo passo e score sugerido.

Tambem sao exibidos:

- resumo comercial;
- avisos da IA;
- badges de prioridade, status e score.

### Como testar

1. Acesse `/leads/ai-import` com usuario autenticado.
2. Cole uma conversa real ou selecione prints em PNG/JPG/WEBP.
3. Clique em `Analisar com IA`.
4. Revise os cards de leads preenchidos pela IA.
5. Use `Copiar resumo` se quiser registrar o resumo/avisos.
6. Clique em `Salvar lead` para um item ou `Salvar todos os leads`.
7. Confirme que os leads aparecem em `/leads` e que os detalhes foram salvos no Supabase.

## Entregavel de Visita e Area do Parceiro

A ficha do lead permite gerar um briefing tecnico/comercial imprimivel em `/leads/[id]/briefing`. O documento usa dados reais do Supabase e foi desenhado para ser salvo como PDF pelo navegador com `window.print()`.

### Briefing de visita

O briefing inclui:

- cabecalho Nova Forma Steel Frame;
- data de geracao, responsavel interno e parceiro/visitante;
- dados do cliente;
- origem, status, prioridade e score;
- dados da obra;
- resumo automatico para o Bruno;
- checklist de pontos para confirmar;
- historico resumido de interacoes;
- proxima acao e observacoes internas;
- botoes para imprimir/salvar PDF, abrir WhatsApp e voltar ao lead.

### Painel do parceiro

A rota `/partner` e protegida por login e mostra leads atribuidos ao parceiro logado. O painel exibe:

- visitas a realizar;
- visitas de hoje;
- visitas realizadas;
- leads aguardando retorno;
- lista de leads atribuidos;
- botoes para WhatsApp, briefing e registro de retorno.

O parceiro pode registrar:

- status da visita;
- observacoes da visita;
- pontos tecnicos identificados;
- se recomenda orcamento;
- se precisa de mais informacoes;
- proxima acao sugerida;
- resumo final do retorno.

### Banco e seguranca

O arquivo `supabase/schema.sql` e o SQL completo para uma instalacao nova. A migracao incremental `supabase/migrations/add_partner_briefing.sql` existe para bancos que ja tinham aplicado a versao anterior sem parceiro/briefing.

Essa camada adiciona os campos de parceiro e visita em `leads`, ajusta RLS para que admin opere o CRM e parceiro visualize apenas leads atribuidos, e cria a RPC `partner_update_visit_feedback` para atualizar somente os campos permitidos:

- `visit_status`;
- `partner_notes`;
- `partner_visit_feedback`.

### Como criar o usuario Bruno

1. Crie o usuario Bruno no Supabase Auth.
2. Depois execute no SQL Editor:

```sql
update public.profiles
set role = 'partner', name = 'Bruno'
where email = 'email-do-bruno@exemplo.com';
```

3. Garanta que o usuario administrativo esteja com role `admin`:

```sql
update public.profiles
set role = 'admin'
where email = 'seu-email-admin@exemplo.com';
```

### Fluxo de teste

1. Admin cria e qualifica um lead.
2. Admin abre a ficha do lead.
3. Admin atribui o lead ao Bruno, define data e status da visita.
4. Admin gera o briefing em `/leads/[id]/briefing`.
5. Bruno faz login.
6. Bruno acessa `/partner` e ve somente leads atribuidos a ele.
7. Bruno abre o briefing.
8. Bruno registra retorno da visita.
9. Admin volta ao lead e ve o retorno nos campos de parceiro.
