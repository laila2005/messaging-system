@echo off
REM Start GUI Client Script for Windows
REM This script starts the graphical chat client

echo ============================================================
echo Starting Secure Business Chat GUI Client
echo ============================================================
echo.

cd /d "%~dp0.."

python clint/gui_client.py

pause
