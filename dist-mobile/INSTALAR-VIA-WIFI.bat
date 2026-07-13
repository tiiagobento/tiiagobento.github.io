@echo off
setlocal enabledelayedexpansion
title Instalar APK via Wi-Fi - Nova Forma CRM

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
set "APK=%~dp0app-debug.apk"
set "DEVICE_FOUND="

echo ============================================
echo Nova Forma CRM - Instalar APK via Wi-Fi
echo ============================================
echo.

if not exist "%ADB%" (
  echo ERRO: ADB nao encontrado em:
  echo %ADB%
  echo.
  pause
  exit /b 1
)

if not exist "%APK%" (
  echo ERRO: app-debug.apk nao encontrado nesta pasta:
  echo %~dp0
  echo.
  pause
  exit /b 1
)

echo Aparelhos conectados:
"%ADB%" devices -l
echo.

for /f "skip=1 tokens=1,2" %%A in ('"%ADB%" devices') do (
  if "%%B"=="device" set "DEVICE_FOUND=%%A"
)

if not defined DEVICE_FOUND (
  echo Nenhum celular conectado/autorizado por Wi-Fi.
  echo.
  echo Primeiro rode:
  echo 1. PAREAR-WIFI.bat, se ainda nao pareou.
  echo 2. CONECTAR-WIFI.bat, para conectar no IP:PORTA do celular.
  echo.
  pause
  exit /b 1
)

echo Instalando em: !DEVICE_FOUND!
echo APK: %APK%
echo.

"%ADB%" -s "!DEVICE_FOUND!" install -r "%APK%"
if errorlevel 1 (
  echo.
  echo ERRO: A instalacao via Wi-Fi falhou.
  echo.
  echo Tente:
  echo - confirmar se celular e computador estao na mesma rede.
  echo - manter a tela "Depuracao sem fio" aberta.
  echo - rodar CONECTAR-WIFI.bat novamente.
  echo - usar INSTALAR-VIA-USB.bat como alternativa.
  echo.
  pause
  exit /b 1
)

echo.
echo APK instalado via Wi-Fi. Abra o app Nova Forma CRM no celular.
echo.
pause
