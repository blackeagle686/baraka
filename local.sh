#!/bin/bash
# ===================================================
#   📦 Baraka SaaS Platform Local Workspace Launcher (POSIX)
# ===================================================

echo "==================================================="
echo "  🚀 Starting Baraka Local Services in Background..."
echo "==================================================="

# Function to clean up background processes upon Ctrl+C exit
cleanup() {
    echo ""
    echo "🚨 Received shutdown signal. Cleaning up background services..."
    kill $(jobs -p) 2>/dev/null
    echo "✅ Shutdown complete. All local services stopped."
    exit
}

# Trap interruption signals to trigger cleanup
trap cleanup SIGINT SIGTERM

# 1. Start Redis Cache Server
echo "[1/4] Starting Redis Cache Server..."
redis-server > /dev/null 2>&1 &

# 2. Start PostgreSQL Database
echo "[2/4] Assuring PostgreSQL Database Service is active..."
# On Ubuntu, usually runs via systemctl. We can log status.
if command -v systemctl &> /dev/null; then
    sudo systemctl start postgresql
fi

# 3. Start Django Backend Server
echo "[3/4] Starting Django API Backend Server on port 8000..."
./venv/bin/python manage.py runserver 0.0.0.0:8000 &

# 4. Start Celery Worker
echo "[4/4] Starting Celery Background Workers..."
./venv/bin/celery -A backend worker --loglevel=info &

# 5. Start Python Lightweight Frontend Static Server
echo "[5/4] Starting Frontend Static Server on http://localhost:8080..."
python3 -m http.server 8080 --directory frontend &

echo ""
echo "==================================================="
echo "  ⚡ All services launched!"
echo "  ⚡ Press [Ctrl+C] to gracefully stop all services."
echo "==================================================="
echo ""

# Keep shell active to receive trap
wait
