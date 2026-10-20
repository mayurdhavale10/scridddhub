@echo off
rem Double-click to start Docker, the database, the backend, the emulator and the app.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dev.ps1" %*
pause
