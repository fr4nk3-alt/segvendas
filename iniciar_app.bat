@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONPATH=%~dp0
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
