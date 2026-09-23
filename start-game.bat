@echo off
rem Double-click me to play Prism Puff. Opens the game at http://localhost in your browser.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
if errorlevel 1 pause
