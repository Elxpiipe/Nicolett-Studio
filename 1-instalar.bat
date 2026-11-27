@echo off
setlocal EnableExtensions
title Nicolett Sync - Instalacion
cd /d "%~dp0"

echo.
echo  ==================================================
echo    NICOLETT SYNC - Instalacion
echo  ==================================================
echo.
echo  Antes de seguir, este PC necesita:
echo    - Node.js 22 LTS          https://nodejs.org
echo    - PostgreSQL 14 o mayor   https://www.postgresql.org/download/windows/
echo      (anota la clave que le pones al usuario postgres)
echo.

rem ---------- Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
  echo  [X] No se encontro Node.js.
  echo      Instala la version 22 LTS, cierra esta ventana y vuelve a abrir el instalador.
  start "" "https://nodejs.org/es/download"
  goto fin_error
)
for /f "tokens=1 delims=." %%v in ('node -v') do set "NODEV=%%v"
set "NODEV=%NODEV:v=%"
echo  [OK] Node.js version %NODEV%
if %NODEV% LSS 20 (
  echo  [X] Esta version es muy antigua. Instala Node.js 22 LTS.
  start "" "https://nodejs.org/es/download"
  goto fin_error
)
if %NODEV% GEQ 23 (
  echo  [!] Se recomienda Node.js 22. Con versiones mas nuevas el proyecto funciona,
  echo      pero la migracion desde SQLite podria no instalarse.
)
echo.

rem ---------- Backend ----------
echo  [1/5] Instalando dependencias del backend (puede tardar unos minutos)...
cd /d "%~dp0backend"
call npm install --no-fund --no-audit
if errorlevel 1 goto error_npm

echo.
echo  [2/5] Configurando la base de datos...
node scripts\configurar.js
if errorlevel 1 goto fin_error

echo  [3/5] Creando las tablas...
call npm run db:init
if errorlevel 1 goto fin_error

echo.
echo  [4/5] Datos iniciales
if exist "db\nicolett.db" (
  echo    Se encontro una base antigua de SQLite: backend\db\nicolett.db
  echo      1 = Copiar esos datos a PostgreSQL
  echo      2 = Cargar datos de demostracion
  echo      3 = No cargar nada
  choice /c 123 /n /m "    Elige 1, 2 o 3: "
  if errorlevel 3 goto frontend
  if errorlevel 2 goto demo
  call npm run db:migrar-sqlite
  goto frontend
)
echo    Datos de demostracion: servicios, profesionales, productos y cuentas de prueba.
choice /c SN /n /m "    Cargar datos de demostracion? (S/N): "
if errorlevel 2 goto frontend

:demo
call npm run demo
if errorlevel 1 goto fin_error

:frontend
echo.
echo  [5/5] Instalando dependencias del frontend...
cd /d "%~dp0frontend"
call npm install --no-fund --no-audit
if errorlevel 1 goto error_npm
if not exist ".env" copy ".env.example" ".env" >nul

echo.
echo  ==================================================
echo    Instalacion lista.
echo    Para abrir el sistema, ejecuta 2-iniciar.bat
echo  ==================================================
echo.
pause
exit /b 0

:error_npm
echo.
echo  [X] npm no pudo instalar las dependencias. Revisa tu conexion a internet
echo      y vuelve a ejecutar este archivo.

:fin_error
echo.
echo  La instalacion no termino. Corrige el problema indicado arriba y vuelve a
echo  ejecutar 1-instalar.bat (se puede ejecutar las veces que haga falta).
echo.
pause
exit /b 1
