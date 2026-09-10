@echo off
setlocal
cd /d "%~dp0.."
title Configurar senha mestre - SEG Vendas
if exist "runtime\python.exe" (
  "runtime\python.exe" scripts\configurar_senha_mestre.py
) else (
  py -3 scripts\configurar_senha_mestre.py
)
echo.
pause
endlocal
