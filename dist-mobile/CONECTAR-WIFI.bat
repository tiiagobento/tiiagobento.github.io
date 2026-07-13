@echo off
setlocal
title Conectar Android por Wi-Fi - Nova Forma CRM

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

echo ============================================
echo Nova Forma CRM - Conectar depuracao Wi-Fi
echo ============================================
echo.

if not exist "%ADB%" (
  echo ERRO: ADB nao encontrado em:
  echo %ADB%
  echo.
  pause
  exit /b 1
)

echo No celular, em Depuracao sem fio, veja o endereco IP e porta.
echo Normalmente aparece como: 192.168.0.25:38791
echo.
echo Importante:
echo - Computador e celular precisam estar na mesma rede Wi-Fi.
echo - Use a porta de CONEXAO, nao a porta temporaria de PAREAMENTO.
echo.

set /p DEVICE_ADDRESS=Digite o IP:PORTA de conexao do celular: 
if "%DEVICE_ADDRESS%"=="" (
  echo Nenhum endereco informado.
  pause
  exit /b 1
)

"%ADB%" connect %DEVICE_ADDRESS%
echo.
"%ADB%" devices -l
echo.
echo Se aparecer "device", pode rodar INSTALAR-VIA-WIFI.bat.
echo Se aparecer "offline" ou falhar, confirme IP/porta e se a depuracao sem fio esta ativa.
echo.
pause
