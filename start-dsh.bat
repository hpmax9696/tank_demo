@echo off
title DeepSeek Harness Web (dsh)
netstat -ano | findstr ":3080 .*LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo [info] Port 3080 is already in use - dsh web seems to be running.
  echo        Just open http://127.0.0.1:3080 in your browser.
  echo.
  pause
  exit /b 0
)
echo Starting DeepSeek Harness Web ...
echo Keep this window open (or minimize it). Closing it stops dsh.
echo.
dsh web
pause
