@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: 坦克对战 Demo — HTTP 本地服务器启动脚本
:: 端口: 8080 | 访问: http://127.0.0.1:8080
:: ============================================

cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════╗
echo ║   坦克对战 Demo — 本地服务器           ║
echo ║   端口: 8080                           ║
echo ║   地址: http://127.0.0.1:8080          ║
echo ╚════════════════════════════════════════╝
echo.

:: ── 第1步: 清理旧进程 ──
echo [1/3] 检查 8080 端口占用...
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080.*LISTENING" 2^>nul') do (
    set FOUND=1
    set PID=%%a
    echo [清理] 终止旧进程 PID=!PID!
    taskkill /F /PID !PID! >nul 2>&1
)
if !FOUND!==0 echo [清理] 端口空闲，无需清理
echo.

:: ── 第2步: 启动服务器 ──
echo [2/3] 启动 Python HTTP 服务器...
start "坦克Demo服务器" /MIN cmd /c "cd /d "%~dp0" && python -m http.server 8080 --bind 127.0.0.1"

:: 等待服务器就绪
timeout /t 2 /nobreak >nul

:: ── 第3步: 验证并打开浏览器 ──
echo [3/3] 验证服务器...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080.*LISTENING" 2^>nul') do (
    echo [就绪] 服务器已启动 ^(PID=%%a^)
    echo.
    echo 正在打开浏览器...
    start http://127.0.0.1:8080
    echo.
    echo ════════════════════════════════════════
    echo   服务器运行中。关闭此窗口停止服务。
    echo   强制刷新: Ctrl+F5
    echo ════════════════════════════════════════
    goto :eof
)

:: 启动失败
echo [错误] 服务器启动失败！请检查 Python 是否正确安装。
echo        运行: python --version
pause
