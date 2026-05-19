import subprocess
import sys
import time
import os
import signal

# List of services to run
commands = [
    ("Redis", "redis-server"),
    ("PostgreSQL", "net start postgresql-x64-16"),
    ("Django Backend", "venv\\Scripts\\python.exe manage.py runserver 0.0.0.0:8000"),
    ("Celery Worker", "venv\\Scripts\\celery.exe -A backend worker --loglevel=info"),
    ("Frontend Static", "python -m http.server 8080 --directory frontend")
]

processes = []

def cleanup(sig, frame):
    print("\n🛑 Shutting down all Baraka services...")
    for name, p in processes:
        print(f"Stopping {name} (PID: {p.pid})...")
        try:
            # Force kill the process tree on Windows to ensure no orphaned child processes
            subprocess.run(f"taskkill /F /T /PID {p.pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            print(f"Error stopping {name}: {e}")
    print("✅ All services stopped. Goodbye!")
    sys.exit(0)

# Register interrupt signals
signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

print("===================================================")
print("  📦 Baraka SaaS Platform Local Workspace Runner")
print("  Running all services in a single console tab...")
print("===================================================\n")

for name, cmd in commands:
    print(f"🚀 Starting {name}...")
    try:
        # Start each command in the background with output printing to the current terminal
        p = subprocess.Popen(cmd, shell=True)
        processes.append((name, p))
    except Exception as e:
        print(f"❌ Failed to start {name}: {e}")
    time.sleep(1.5)  # Pause to let the service bind/start

print("\n===================================================")
print("  🔥 All services running in this tab!")
print("  ⚠️  Press [Ctrl+C] to STOP ALL SERVICES at once.")
print("===================================================\n")

# Keep main thread alive
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    cleanup(None, None)
