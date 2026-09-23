@echo off
chcp 65001 >nul
rem Loja de laboratório que sincroniza com o hub local (mesmo PC, porta 8090).
cd /d "%~dp0.."
set PYTHONPATH=%CD%
set SEG_APP_MODE=1
set SEG_PORT=8090
set SEG_DATA_DIR=%CD%\data_loja_teste
set SEG_STORE_ID=loja-1
set SEG_STORE_NAME=Loja Teste 1
set SEG_REPLICATION_ENABLED=1
set SEG_REPLICATION_WORKER=1
set SEG_REPLICATION_INTERVAL=60
set SEG_REPLICATION_HUB_URL=http://127.0.0.1:8080
set SEG_REPLICATION_TOKEN=seg_loja1_trocar
set SEG_REPLICATION_ALLOW_HTTP=1
if exist "%CD%\runtime\python.exe" (
  "%CD%\runtime\python.exe" servidor.py
) else (
  where py >nul 2>nul
  if not errorlevel 1 (
    py servidor.py
  ) else (
    python servidor.py
  )
)
pause
