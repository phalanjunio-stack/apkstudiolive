@echo off
title SeteLagoas Live
cd /d "%~dp0"
echo Iniciando SeteLagoas Live (com tunel seguro)...
node launch.mjs
echo.
echo (a janela fechou ou deu erro) — aperte uma tecla pra sair
pause >nul
