@echo off
REM Start Server Script for Windows
REM This script starts the chat server

echo ============================================================
echo Starting Secure Business Chat Server
echo ============================================================
echo.

cd /d "%~dp0.."

python server/server.py

pause
