# Release Android

Este documento prepara a geracao de APK/AAB release assinado do Nova Forma CRM.

Importante:

- nao commite keystore
- nao commite senhas
- nao coloque segredo em `.env.example`
- guarde a keystore em local seguro e com backup
- se perder a keystore, voce pode perder a capacidade de atualizar o app publicado

## Pre-requisitos

- JDK 21 instalado
- Android SDK instalado
- APK debug validado em celular fisico
- producao web funcionando em `https://nova-forma-crm.vercel.app`
- `npx cap sync android` executado depois do ultimo build web

## Criar keystore

Sugestao de pasta local, ignorada pelo Git:

```powershell
New-Item -ItemType Directory -Force -Path E:\NovaFormaCRM\android\keystores
```

Criar a keystore:

```powershell
& "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\bin\keytool.exe" `
  -genkeypair `
  -v `
  -keystore E:\NovaFormaCRM\android\keystores\nova-forma-release.jks `
  -alias nova-forma-crm `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000
```

Anote a senha da keystore, a senha da chave e o alias. Nao salve isso no repositorio.

## Variaveis locais de assinatura

No PowerShell, antes de gerar release:

```powershell
$env:NOVAFORMA_ANDROID_KEYSTORE_PATH="E:\NovaFormaCRM\android\keystores\nova-forma-release.jks"
$env:NOVAFORMA_ANDROID_KEYSTORE_PASSWORD="SUA_SENHA_KEYSTORE"
$env:NOVAFORMA_ANDROID_KEY_ALIAS="nova-forma-crm"
$env:NOVAFORMA_ANDROID_KEY_PASSWORD="SUA_SENHA_DA_CHAVE"
```

Essas variaveis sao lidas por `android/app/build.gradle`. Se elas nao existirem, o release nao recebe assinatura local.

## Gerar APK release

Na raiz do projeto:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npx cap sync android
npm run android:release
```

Arquivo esperado:

```text
E:\NovaFormaCRM\android\app\build\outputs\apk\release\app-release.apk
```

Validar assinatura:

```powershell
$sdk=Join-Path $env:LOCALAPPDATA "Android\Sdk"
& "$sdk\build-tools\35.0.0\apksigner.bat" verify --verbose E:\NovaFormaCRM\android\app\build\outputs\apk\release\app-release.apk
```

Instalar em celular via USB:

```powershell
$sdk=Join-Path $env:LOCALAPPDATA "Android\Sdk"
& "$sdk\platform-tools\adb.exe" install -r E:\NovaFormaCRM\android\app\build\outputs\apk\release\app-release.apk
```

## Gerar AAB para loja

```powershell
npm run android:bundle
```

Arquivo esperado:

```text
E:\NovaFormaCRM\android\app\build\outputs\bundle\release\app-release.aab
```

Use AAB para Google Play. Para distribuicao direta/teste interno fora da loja, APK release assinado costuma ser mais simples.

## Checklist antes de distribuir

- login funciona no celular fisico
- rotas privadas redirecionam corretamente
- dashboard abre e mostra dados reais
- leads criam/editam/excluem
- WhatsApp abre com telefone e mensagem corretos
- pipeline muda status
- tarefas criam/concluem
- templates copiam e abrem WhatsApp
- IA avisa quando precisa de internet
- offline abre app depois do primeiro carregamento
- fila de sincronizacao aparece em Settings
- ao voltar internet, fila sincroniza
- logout limpa sessao e dados locais do usuario

## Limites conhecidos

- IA, login novo e sincronizacao com Supabase precisam de internet
- Puter depende de autorizacao no navegador
- o APK usa a producao `https://nova-forma-crm.vercel.app` dentro do Capacitor
- release assinado exige keystore local configurada por variaveis de ambiente
