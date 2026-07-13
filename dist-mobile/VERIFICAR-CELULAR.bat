@echo off
setlocal
title Verificar celular Android - Nova Forma CRM

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

echo ============================================
echo Nova Forma CRM - Verificar celular Android
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

echo Usando ADB:
echo %ADB%
echo.

"%ADB%" devices -l

echo.
echo Se a lista estiver vazia:
echo - Conecte o celular via USB.
echo - Ative Depuracao USB.
echo - Desbloqueie o celular.
echo - Aceite a autorizacao RSA/USB no aparelho.
echo.
echo Se aparecer "unauthorized":
echo - Aceite a autorizacao USB no celular.
echo - Troque cabo/porta USB se necessario.
echo.
pause
