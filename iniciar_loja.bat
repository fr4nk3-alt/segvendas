@echo off
chcp 65001 >nul
rem ============================================================
rem  SEG Vendas - Loja com sincronização para o hub na nuvem
rem
rem  EDITE APENAS AS 3 LINHAS ABAIXO antes de usar na loja:
rem ============================================================
set SEG_STORE_ID=loja-1
set SEG_STORE_NAME=Loja Exemplo
set SEG_REPLICATION_TOKEN=seg_loja1_trocar
rem ============================================================

cd /d "%~dp0"
set PYTHONPATH=%~dp0

rem Identidade e sincronização
set SEG_REPLICATION_ENABLED=1
set SEG_REPLICATION_WORKER=1
set SEG_REPLICATION_INTERVAL=60
set SEG_REPLICATION_HUB_URL=https://segvendas-production-509a.up.railway.app

if exist "%~dp0runtime\python.exe" (
  "%~dp0runtime\python.exe" servidor.py
) else (
  where py >nul 2>nul
  if not errorlevel 1 (
    py servidor.py
  ) else (
    python servidor.py
  )
)
pause
