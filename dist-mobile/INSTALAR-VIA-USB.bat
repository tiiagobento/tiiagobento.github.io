@echo off
setlocal enabledelayedexpansion
title Instalar APK - Nova Forma CRM

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
set "APK=%~dp0app-debug.apk"
set "DEVICE_FOUND="
set "UNAUTHORIZED_FOUND="

echo ============================================
echo Nova Forma CRM - Instalar APK via USB
echo ============================================
echo.

if not exist "%ADB%" (
  echo ERRO: ADB nao encontrado em:
  echo %ADB%
  echo.
  echo Instale o Android SDK Platform Tools ou confira a instalacao do Android SDK.
  echo.
  pause
  exit /b 1
)

if not exist "%APK%" (
  echo ERRO: app-debug.apk nao encontrado nesta pasta:
  echo %~dp0
  echo.
  echo Copie o APK para esta pasta e tente novamente.
  echo.
  pause
  exit /b 1
)

echo Verificando celular conectado...
echo.
"%ADB%" devices
echo.

for /f "skip=1 tokens=1,2" %%A in ('"%ADB%" devices') do (
  if "%%B"=="device" set "DEVICE_FOUND=%%A"
  if "%%B"=="unauthorized" set "UNAUTHORIZED_FOUND=%%A"
)

if defined UNAUTHORIZED_FOUND (
  echo O celular apareceu como UNAUTHORIZED.
  echo.
  echo Faca isso:
  echo 1. Desbloqueie o celular.
  echo 2. Aceite a autorizacao RSA/USB.
  echo 3. Rode este instalador novamente.
  echo.
  pause
  exit /b 1
)

if not defined DEVICE_FOUND (
  echo Nenhum celular autorizado foi encontrado.
  echo.
  echo Conecte o celular via USB, ative Depuracao USB e aceite a autorizacao no aparelho.
  echo Depois rode VERIFICAR-CELULAR.bat ou este instalador novamente.
  echo.
  pause
  exit /b 1
)

echo Instalando APK no aparelho: !DEVICE_FOUND!
echo APK: %APK%
echo.

"%ADB%" -s "!DEVICE_FOUND!" install -r "%APK%"
if errorlevel 1 (
  echo.
  echo ERRO: A instalacao falhou.
  echo.
  echo Possiveis solucoes:
  echo - Desinstale uma versao antiga do app no celular e tente de novo.
  echo - Confira se ha espaco livre no aparelho.
  echo - Confirme se o cabo USB esta estavel.
  echo.
  pause
  exit /b 1
)

echo.
echo APK instalado. Abra o app Nova Forma CRM no celular.
echo.
pause
