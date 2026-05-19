#!/bin/bash
# ===================================================
#   📦 Baraka SaaS Platform Local Workspace Launcher (POSIX)
# ===================================================

echo "==================================================="
echo "  🚀 Starting Baraka Local Services..."
echo "==================================================="
echo ""

# Activate virtual environment if available, then start the runner
if [ -d "venv" ]; then
    source venv/bin/activate
fi

python3 local_runner.py

