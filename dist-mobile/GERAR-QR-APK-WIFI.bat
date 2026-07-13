@echo off
setlocal
title Gerar QR APK Wi-Fi - Nova Forma CRM

cd /d "%~dp0"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "(Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "WIFI_IP=%%I"

if "%WIFI_IP%"=="" (
  echo Nao consegui detectar o IP da interface Wi-Fi.
  echo Confira se o computador esta conectado ao Wi-Fi.
  pause
  exit /b 1
)

set "APK_URL=http://%WIFI_IP%:8765/app-debug.apk"

echo Gerando QR Code para:
echo %APK_URL%
echo.

python -c "import qrcode; url=r'%APK_URL%'; img=qrcode.make(url); img.save('qr-instalar-apk-local.png'); print('QR gerado em qr-instalar-apk-local.png')"

echo.
echo Agora rode ABRIR-SERVIDOR-APK.bat e escaneie qr-instalar-apk-local.png no celular.
echo.
pause
