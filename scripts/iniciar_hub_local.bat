@echo off
chcp 65001 >nul
rem Servidor central (hub) de replicação entre lojas.
rem Rode no PC que fará o papel de servidor.
cd /d "%~dp0.."
set PYTHONPATH=%CD%
set SEG_APP_MODE=1
set SEG_PORT=8080
set SEG_BIND_ADDRESS=0.0.0.0
set SEG_STORE_ID=central
set SEG_STORE_NAME=Servidor Central
set SEG_REPLICATION_HUB=1
rem Mapa de lojas autorizadas: {"id-da-loja":"senha-da-loja"}
set SEG_REPLICATION_STORE_TOKENS={"loja-1":"seg_loja1_trocar"}
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
