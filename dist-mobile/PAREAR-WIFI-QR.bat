@echo off
setlocal
title Parear Android por QR - Nova Forma CRM

cd /d "%~dp0"

echo ============================================
echo Nova Forma CRM - Parear Android por QR
echo ============================================
echo.
echo Este script gera qr-pareamento-adb.png e aguarda o celular escanear.
echo Deixe esta janela aberta ate concluir.
echo.

python adb_qr_pair.py

echo.
pause
