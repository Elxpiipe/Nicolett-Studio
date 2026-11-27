@echo off
setlocal EnableExtensions
title Nicolett Sync - ngrok (WhatsApp)
cd /d "%~dp0"

echo.
echo  Abre el tunel de ngrok para que Meta (WhatsApp) llegue a tu backend.
echo  Primero debe estar corriendo el sistema (2-iniciar.bat).
echo.

set "NGROK="
if exist "%USERPROFILE%\ngrok\ngrok.exe" set "NGROK=%USERPROFILE%\ngrok\ngrok.exe"
if not defined NGROK if exist "%~dp0ngrok.exe" set "NGROK=%~dp0ngrok.exe"
if not defined NGROK (
  for /f "delims=" %%n in ('where ngrok 2^>nul') do if not defined NGROK set "NGROK=%%n"
)
if not defined NGROK (
  echo  [X] No se encontro ngrok.
  echo      1. Descarga el ZIP de Windows desde https://ngrok.com/download
  echo      2. Deja ngrok.exe en %USERPROFILE%\ngrok\  o en esta carpeta
  echo      3. Ejecuta una vez:  ngrok config add-authtoken TU_AUTHTOKEN
  start "" "https://ngrok.com/download"
  pause
  exit /b 1
)

echo  Usando: %NGROK%
echo.
echo  Cuando aparezca "Forwarding https://....ngrok-free.dev", esa direccion debe
echo  estar en BACKEND_URL de backend\.env y en el webhook de Meta.
echo  (Con cuenta gratis de ngrok la direccion se mantiene igual cada vez.)
echo.
"%NGROK%" http 4000
pause
