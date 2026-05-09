#!/bin/bash
# ============================================
# 坦克对战 Demo — HTTP 本地服务器启动脚本
# 端口: 8080 | 访问: http://127.0.0.1:8080
# ============================================

cd "$(dirname "$0")"

echo
echo "╔════════════════════════════════════════╗"
echo "║   坦克对战 Demo — 本地服务器           ║"
echo "║   端口: 8080                           ║"
echo "║   地址: http://127.0.0.1:8080          ║"
echo "╚════════════════════════════════════════╝"
echo

# ── 第1步: 清理旧进程 ──
echo "[1/3] 检查 8080 端口占用..."
OLD_PID=$(lsof -ti:8080 2>/dev/null)
if [ -n "$OLD_PID" ]; then
    echo "[清理] 终止旧进程 PID=$OLD_PID"
    kill -9 $OLD_PID 2>/dev/null
    sleep 1
else
    echo "[清理] 端口空闲，无需清理"
fi
echo

# ── 第2步: 启动服务器 ──
echo "[2/3] 启动 Python HTTP 服务器..."
python3 -m http.server 8080 --bind 127.0.0.1 &
SERVER_PID=$!
sleep 1

# ── 第3步: 验证 ──
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "[3/3] 服务器已启动 (PID=$SERVER_PID)"
    echo
    echo "访问地址: http://127.0.0.1:8080"
    echo "强制刷新: Ctrl+F5"
    echo "════════════════════════════════════════"
    echo "服务器运行中。按 Ctrl+C 停止。"
    echo "════════════════════════════════════════"
    wait $SERVER_PID
else
    echo "[错误] 服务器启动失败！"
    exit 1
fi
