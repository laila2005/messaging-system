@echo off
REM Start CLI Client Script for Windows
REM This script starts the command-line chat client

echo ============================================================
echo Starting Secure Business Chat CLI Client
echo ============================================================
echo.

cd /d "%~dp0.."

python clint/client.py

pause
