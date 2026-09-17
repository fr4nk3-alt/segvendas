@echo off
chcp 65001 >nul
setlocal
title Instalador SEG Vendas 5.9.14

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\instalar_seg_vendas_pro.ps1"
set "SEG_INSTALL_RESULT=%errorlevel%"

if not "%SEG_INSTALL_RESULT%"=="0" (
  echo.
  echo  A instalacao foi interrompida. Verifique a mensagem de erro.
  echo.
  pause
  exit /b %SEG_INSTALL_RESULT%
)

exit /b 0
