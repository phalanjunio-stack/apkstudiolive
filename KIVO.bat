@echo off
title Kivo Studio
cd /d "%~dp0"
echo Abrindo o Kivo Studio...
call npm run app
if errorlevel 1 (
  echo.
  echo [ERRO] Nao consegui abrir. Verifique se o Node esta instalado e rode "npm install".
  pause
)
