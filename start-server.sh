#!/bin/bash
# Tank Demo HTTP Server Launcher
# Port: 8080
# Usage: ./start-server.sh

cd "$(dirname "$0")"

echo "========================================"
echo "  Tank Demo - HTTP Server"
echo "  Port: 8080"
echo "  URL: http://localhost:8080"
echo "========================================"
echo ""
echo "Starting server..."
echo "Press Ctrl+C to stop the server."
echo ""

python3 -m http.server 8080
