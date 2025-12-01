@echo off
REM Run Tests Script for Windows
REM This script runs all test files

echo ============================================================
echo Running Secure Business Chat Tests
echo ============================================================
echo.

cd /d "%~dp0.."

echo Running Database Tests...
echo ============================================================
python tests/test_database.py
echo.

echo Running Encryption Tests...
echo ============================================================
python tests/test_encryption.py
echo.

echo ============================================================
echo All tests completed!
echo ============================================================

pause
