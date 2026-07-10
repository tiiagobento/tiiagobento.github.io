# APK Android

O Nova Forma CRM usa Capacitor Android com a aplicacao web em producao:

- URL: `https://nova-forma-crm.vercel.app`
- App ID: `br.com.novaforma.crm`
- Nome: `Nova Forma CRM`

Essa escolha evita forcar export estatico do Next.js App Router, que quebraria rotas privadas, Supabase Auth, API Routes de IA e SSR. O primeiro carregamento precisa de internet; depois, o service worker e o IndexedDB permitem abrir o app shell e trabalhar com dados sincronizados.

## Comandos

```bash
npm install
npm run android:sync
npm run android:debug
```

O APK debug fica em:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Gerar AAB release:

```bash
npm run android:release
```

Para release de loja, configure uma keystore no Android Studio ou no Gradle local. Nao commite keystore, senhas ou APK/AAB assinados.

## Android Studio

1. Abra a pasta `android` no Android Studio.
2. Aguarde o Gradle sincronizar.
3. Conecte um celular com depuracao USB ou use emulador.
4. Rode `app`.

## Teste offline no celular

1. Instale o APK debug.
2. Abra com internet e faca login.
3. Navegue nas telas principais.
4. Desative Wi-Fi/dados.
5. Abra o app novamente.
6. Crie um lead ou tarefa.
7. Abra Settings e veja a operacao pendente.
8. Reative a internet e sincronize.

## Limites

Funciona offline para dados ja sincronizados e operacoes basicas. Login novo, IA, Puter, analise de prints e sincronizacao com Supabase precisam de internet.
