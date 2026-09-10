@echo off
chcp 65001 >nul
cd /d "%~dp0.."
title SEG Vendas 5.9.14 - Configurar rede

if exist "runtime\python.exe" (
  "runtime\python.exe" scripts\configurar_rede_beta.py
) else (
  where py >nul 2>nul
  if not errorlevel 1 (
    py scripts\configurar_rede_beta.py
  ) else (
    python scripts\configurar_rede_beta.py
  )
)

echo.
pause
