@echo off
setlocal
cd /d "%~dp0"
title Techno 404 Studio v4.3.0
set "PORT=8040"
set "URL=http://127.0.0.1:%PORT%"
echo ==============================================
echo       TECHNO 404 STUDIO v4.3.0
echo ==============================================
echo.
echo Iniciando servidor local en %URL% ...
where py >nul 2>nul
if %errorlevel%==0 (
  start "Techno 404 Server" /min py -m http.server %PORT% --bind 127.0.0.1
  timeout /t 1 /nobreak >nul
  start "" "%URL%"
  exit /b 0
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "Techno 404 Server" /min python -m http.server %PORT% --bind 127.0.0.1
  timeout /t 1 /nobreak >nul
  start "" "%URL%"
  exit /b 0
)
echo [AVISO] Python no esta instalado.
echo Se abrira index.html directamente. PWA, Service Worker, IndexedDB y Web MIDI funcionan mejor con servidor local.
pause
start "" "%~dp0index.html"
