# Nova Forma CRM - Release Notes

## v1.2.3 - 2026-07-28

Correcao emergencial do APK Android.

- Evita que o registro nativo de push seja inicializado sem Firebase configurado.
- Mantem notificacoes push como recurso opt-in via `NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=true` e `NEXT_PUBLIC_ANDROID_FIREBASE_CONFIGURED=true`.
- APK/AAB Android atualizados para `versionName 1.2.3` e `versionCode 6`.

## v1.2.2 - 2026-07-28

Versao final consolidada para producao web e Android.

- Publicacao confirmada na Vercel com o alias `https://nova-forma-crm.vercel.app`.
- CRM com rotas principais, autenticacao, leads, tarefas, templates, pipeline, parceiro e IA server-side.
- Controle de acesso e painel de usuarios administrativos.
- Suporte offline/sync e notificacoes push Android para fluxo de parceiro.
- APK/AAB Android preparados com versionamento alinhado ao app web.
- Migrations Supabase consolidadas para perfis, leads, interacoes, tarefas, templates, parceiro, notificacoes e push.

Artefatos esperados:

- Web: Vercel em producao.
- Android APK: `dist-mobile/nova-forma-crm-release.apk`.
- Android AAB: `dist-mobile/nova-forma-crm-release.aab`.
