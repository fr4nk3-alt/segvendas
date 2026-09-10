@echo off
chcp 65001 >nul
setlocal
title Instalador SEG Vendas 5.9.14

echo.
echo  SEG VENDAS 5.9.14 - INSTALACAO OU ATUALIZACAO
echo  ------------------------------------------------
echo  Aguarde enquanto o aplicativo e preparado...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\instalar_seg_vendas.ps1"
set "SEG_INSTALL_RESULT=%errorlevel%"

if not "%SEG_INSTALL_RESULT%"=="0" (
  echo.
  echo  Nao foi possivel concluir a instalacao.
  echo  Leia a mensagem acima e tente novamente.
  echo.
  pause
  exit /b %SEG_INSTALL_RESULT%
)

echo.
echo  Instalacao concluida. Foram criados os atalhos do aplicativo e da configuracao de rede.
echo  Esta janela sera fechada em alguns segundos.
timeout /t 4 /nobreak >nul
exit /b 0
