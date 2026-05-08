@echo off
:: Tank Demo HTTP Server Launcher
:: Port: 8080
:: Usage: Double-click this file or run: start-server.bat

cd /d "%~dp0"
echo ========================================
echo   Tank Demo - HTTP Server
echo   Port: 8080
echo   URL: http://localhost:8080
echo ========================================
echo.
echo Starting server...
echo Press Ctrl+C to stop the server.
echo.

python -m http.server 8080
