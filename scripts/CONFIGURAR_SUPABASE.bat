@echo off
chcp 65001 >nul
cd /d "%~dp0.."
title SEG Vendas - Configurar Supabase
if exist "runtime\python.exe" (
  "runtime\python.exe" scripts\configurar_supabase.py %*
) else (
  where py >nul 2>nul
  if not errorlevel 1 (py scripts\configurar_supabase.py %*) else (python scripts\configurar_supabase.py %*)
)
pause
