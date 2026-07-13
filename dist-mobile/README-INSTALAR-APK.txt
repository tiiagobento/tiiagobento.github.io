NOVA FORMA CRM - INSTALAR APK NO ANDROID
========================================

Arquivo principal:

app-debug.apk

Este APK e uma versao de teste/debug do Nova Forma CRM para Android.


1. INSTALAR MANUALMENTE, SEM CABO USB
-------------------------------------

1. Envie o arquivo app-debug.apk para o celular.
   Voce pode usar WhatsApp, Google Drive, cabo USB, e-mail ou outro app.

2. No celular, abra o arquivo app-debug.apk.

3. Se o Android bloquear a instalacao, toque em Configuracoes.

4. Permita "Instalar apps desconhecidos" para o app que abriu o APK.
   Exemplo: Arquivos, Chrome, WhatsApp ou Google Drive.

5. Volte e conclua a instalacao.

6. Abra o app "Nova Forma CRM".


1.1 BAIXAR PELO QR CODE NA MESMA REDE WI-FI
-------------------------------------------

1. Garanta que computador e celular estao no mesmo Wi-Fi.

2. Nesta pasta, rode:

   GERAR-QR-APK-WIFI.bat

3. Depois rode:

   ABRIR-SERVIDOR-APK.bat

4. Deixe a janela do servidor aberta.

5. No celular, abra a camera e escaneie:

   qr-instalar-apk-local.png

6. Baixe o APK e abra o arquivo no Android.

7. Se o Android bloquear a instalacao, permita "Instalar apps desconhecidos".

Observacao: o QR do APK local depende do IP atual do computador. Se mudar de rede, rode GERAR-QR-APK-WIFI.bat novamente.


2. INSTALAR VIA USB
-------------------

1. No Android, ative o modo desenvolvedor:
   Configuracoes > Sobre o telefone > toque 7 vezes em "Numero da versao".

2. Ative a depuracao USB:
   Configuracoes > Sistema > Opcoes do desenvolvedor > Depuracao USB.

3. Conecte o celular no computador com cabo USB.

4. Desbloqueie o celular.

5. Quando aparecer a autorizacao RSA/USB, toque em "Permitir".

6. Nesta pasta, rode:

   VERIFICAR-CELULAR.bat

7. Se aparecer um aparelho como "device", rode:

   INSTALAR-VIA-USB.bat


3. INSTALAR VIA DEPURACAO WI-FI
-------------------------------

Este modo funciona melhor em Android 11 ou superior.

1. No celular, ative o modo desenvolvedor.

2. Entre em:
   Configuracoes > Sistema > Opcoes do desenvolvedor.

3. Ative "Depuracao sem fio".

4. Toque em "Parear dispositivo com codigo de pareamento".

5. Rode nesta pasta:

   PAREAR-WIFI.bat

6. Digite o IP:PORTA de pareamento mostrado no celular.
   Exemplo: 192.168.0.25:42137

7. Quando o ADB pedir, digite o codigo de pareamento.

8. Depois do pareamento, volte na tela "Depuracao sem fio" e veja o IP:PORTA de conexao.
   Normalmente e outra porta.
   Exemplo: 192.168.0.25:38791

9. Rode:

   CONECTAR-WIFI.bat

10. Se aparecer "device", rode:

   INSTALAR-VIA-WIFI.bat

Importante:
- computador e celular precisam estar na mesma rede Wi-Fi.
- mantenha a depuracao sem fio ativa.
- se trocar de rede, provavelmente sera necessario conectar novamente.


4. SE APARECER "UNAUTHORIZED"
-----------------------------

1. Desbloqueie o celular.
2. Veja se apareceu uma tela pedindo autorizacao USB/RSA.
3. Toque em "Permitir".
4. Rode VERIFICAR-CELULAR.bat novamente.
5. Se continuar, troque o cabo USB ou a porta USB.
6. Confirme se a depuracao USB esta ativa.


5. SE O ANDROID BLOQUEAR A INSTALACAO
-------------------------------------

1. Abra Configuracoes.
2. Procure por "Instalar apps desconhecidos".
3. Escolha o app usado para abrir o APK.
   Exemplo: Arquivos, Chrome, WhatsApp ou Google Drive.
4. Ative a permissao.
5. Abra o APK novamente.


6. DEPOIS DE INSTALAR
---------------------

1. Abra o app Nova Forma CRM.
2. Faca login.
3. Teste Dashboard, Leads, Pipeline, Tarefas, Templates e Configuracoes.
4. Use o arquivo CHECKLIST-TESTE-ANDROID.md para validar tudo.


Observacao:
Este APK usa a producao:
https://nova-forma-crm.vercel.app
