@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONPATH=%~dp0
title SEG Vendas - Verificacao (testes automatizados)

if exist "%~dp0runtime\python.exe" (
  set "PY=%~dp0runtime\python.exe"
) else (
  set "PY=python"
)

echo Validando sintaxe do servidor...
"%PY%" -m py_compile servidor.py dataplace_connector.py offline_sync.py store_replication.py supabase_connector.py
if errorlevel 1 goto :falha

echo Executando testes...
"%PY%" -m unittest discover -s tests -v
if errorlevel 1 goto :falha

echo.
echo  RESULTADO: OK
pause
exit /b 0

:falha
echo.
echo  RESULTADO: FALHOU - veja as mensagens acima.
pause
exit /b 1
