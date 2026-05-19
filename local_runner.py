import subprocess
import sys
import time
import os
import signal
import shutil

IS_WINDOWS = os.name == 'nt'

# Define commands depending on OS platform
if IS_WINDOWS:
    # Verify the commands are available or warning will be printed
    commands_to_run = []
    
    # 1. Redis
    if shutil.which("redis-server"):
        commands_to_run.append(("Redis", "redis-server"))
    else:
        print("⚠️  [Warning] 'redis-server' was not found in your PATH.")
        print("    Redis won't be started. The system will fall back to local in-memory cache.\n")

    # 2. PostgreSQL
    commands_to_run.append(("PostgreSQL", "net start postgresql-x64-18"))

    # 3. Django
    commands_to_run.append(("Django Backend", "venv\\Scripts\\python.exe manage.py runserver 0.0.0.0:8000"))

    # 4. Celery
    if shutil.which("venv\\Scripts\\celery.exe") or shutil.which("celery"):
        commands_to_run.append(("Celery Worker", "venv\\Scripts\\celery.exe -A backend worker --loglevel=info"))
    else:
        print("⚠️  [Warning] Celery executable was not found. Background worker task offloading won't be active.\n")

    # 5. Frontend
    commands_to_run.append(("Frontend Static", "python -m http.server 8080 --directory frontend"))

else:
    has_systemctl = os.path.exists("/bin/systemctl") or os.path.exists("/usr/bin/systemctl")
    commands_to_run = []

    # 1. Redis
    if shutil.which("redis-server"):
        commands_to_run.append(("Redis", "redis-server"))
    else:
        print("⚠️  [Warning] 'redis-server' was not found in your PATH. Skipping Redis server.\n")

    # 2. PostgreSQL
    commands_to_run.append(("PostgreSQL", "sudo systemctl start postgresql" if has_systemctl else "echo PostgreSQL assumed running"))

    # 3. Django
    commands_to_run.append(("Django Backend", "./venv/bin/python manage.py runserver 0.0.0.0:8000"))

    # 4. Celery
    if os.path.exists("./venv/bin/celery") or shutil.which("celery"):
        commands_to_run.append(("Celery Worker", "./venv/bin/celery -A backend worker --loglevel=info"))
    else:
        print("⚠️  [Warning] Celery was not found. Skipping Celery background worker.\n")

    # 5. Frontend
    commands_to_run.append(("Frontend Static", "python3 -m http.server 8080 --directory frontend"))

processes = []

def cleanup(sig, frame):
    print("\n🛑 Shutting down all Baraka services...")
    for name, p in processes:
        print(f"Stopping {name} (PID: {p.pid})...")
        try:
            if IS_WINDOWS:
                # Force kill the process tree on Windows to ensure no orphaned child processes
                subprocess.run(f"taskkill /F /T /PID {p.pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                # Send SIGTERM to the process group to clean up shell child processes on Unix
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
        except Exception:
            try:
                p.terminate()
            except Exception:
                pass
    print("✅ All services stopped. Goodbye!")
    sys.exit(0)

# Register interrupt signals
signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

print("===================================================")
print("  📦 Baraka SaaS Platform Local Workspace Runner")
print("  Running all services in a single console tab...")
print("===================================================\n")

for name, cmd in commands_to_run:
    print(f"🚀 Starting {name}...")
    try:
        # Start each command in the background with output printing to the current terminal
        if IS_WINDOWS:
            p = subprocess.Popen(cmd, shell=True)
        else:
            # On Linux/macOS, use setsid to run in a new process group for group termination
            p = subprocess.Popen(cmd, shell=True, preexec_fn=os.setsid)
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
