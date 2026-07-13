@echo off
setlocal
title Parear Android por Wi-Fi - Nova Forma CRM

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

echo ============================================
echo Nova Forma CRM - Parear depuracao Wi-Fi
echo ============================================
echo.

if not exist "%ADB%" (
  echo ERRO: ADB nao encontrado em:
  echo %ADB%
  echo.
  pause
  exit /b 1
)

echo No celular Android:
echo.
echo 1. Abra Configuracoes.
echo 2. Entre em Sistema ^> Opcoes do desenvolvedor.
echo 3. Ative "Depuracao sem fio".
echo 4. Toque em "Parear dispositivo com codigo de pareamento".
echo 5. Anote o IP:PORTA e o CODIGO exibidos.
echo.
echo Exemplo de IP:PORTA para parear: 192.168.0.25:42137
echo.

set /p PAIR_ADDRESS=Digite o IP:PORTA de pareamento: 
if "%PAIR_ADDRESS%"=="" (
  echo Nenhum endereco informado.
  pause
  exit /b 1
)

echo.
echo Quando o ADB pedir, digite o codigo de pareamento mostrado no celular.
echo.
"%ADB%" pair %PAIR_ADDRESS%

echo.
echo Pareamento finalizado.
echo Agora rode CONECTAR-WIFI.bat usando o IP:PORTA de conexao mostrado em "Depuracao sem fio".
echo.
pause
