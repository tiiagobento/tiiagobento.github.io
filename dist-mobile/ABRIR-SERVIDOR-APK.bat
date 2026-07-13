@echo off
setlocal
title Servidor local APK - Nova Forma CRM

cd /d "%~dp0"

echo ============================================
echo Nova Forma CRM - Servidor local do APK
echo ============================================
echo.
echo Esta janela precisa ficar aberta enquanto voce baixa o APK pelo QR Code.
echo.
echo Abra no celular o QR Code qr-instalar-apk-local.png
echo ou acesse manualmente:
echo.
echo http://SEU-IP-DO-COMPUTADOR:8765/app-debug.apk
echo.
echo Para descobrir o IP correto, rode GERAR-QR-APK-WIFI.bat.
echo.

python -m http.server 8765 --bind 0.0.0.0

pause
