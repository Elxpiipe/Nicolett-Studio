@echo off
setlocal EnableExtensions
title Nicolett Sync
cd /d "%~dp0"

if not exist "backend\node_modules" goto falta_instalar
if not exist "frontend\node_modules" goto falta_instalar
if not exist "backend\.env" goto falta_instalar

echo.
echo  Iniciando Nicolett Sync...
echo  Se abriran dos ventanas (backend y frontend). No las cierres mientras uses el sistema.
echo.

rem El backend actualiza las tablas (no borra datos) y luego arranca
start "Nicolett Sync - Backend" /D "%~dp0backend" cmd /k "npm run db:init && npm run dev"
start "Nicolett Sync - Frontend" /D "%~dp0frontend" cmd /k "npm run dev"

echo  Esperando a que el sistema este listo...
set /a INTENTOS=0
:esperar
timeout /t 2 /nobreak >nul
set /a INTENTOS+=1
curl -s -o nul http://localhost:4000/api/salud >nul 2>nul
if not errorlevel 1 goto listo
if %INTENTOS% LSS 30 goto esperar
echo  [!] El backend tarda en responder. Revisa la ventana "Nicolett Sync - Backend".

:listo
timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"
echo.
echo  Listo: el sistema esta en http://localhost:5173
echo  Para apagarlo, cierra las ventanas "Backend" y "Frontend".
echo.
timeout /t 8 >nul
exit /b 0

:falta_instalar
echo.
echo  Primero ejecuta 1-instalar.bat
echo.
pause
exit /b 1
