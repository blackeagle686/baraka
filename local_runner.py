import subprocess
import sys
import time
import os
import signal
import shutil

IS_WINDOWS = os.name == 'nt'

# Parse .env file for active services
db_host_active = False
redis_active = False

if os.path.exists(".env"):
    try:
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DB_HOST=") and not line.startswith("#"):
                    db_host_active = True
                elif (line.startswith("REDIS_URL=") or line.startswith("CELERY_BROKER_URL=")) and not line.startswith("#"):
                    redis_active = True
    except Exception as e:
        print(f"⚠️  Could not parse .env configuration: {e}")

# Build command list depending on OS platform and .env configuration
commands_to_run = []

# 1. Redis Server
if redis_active:
    if IS_WINDOWS:
        if shutil.which("redis-server"):
            commands_to_run.append(("Redis", "redis-server"))
        else:
            print("ℹ️  [Info] 'redis-server' was not found in PATH. Assuming Memurai/Redis is running as a background Windows service.\n")
    else:
        if shutil.which("redis-server"):
            commands_to_run.append(("Redis", "redis-server"))
        else:
            print("⚠️  [Warning] Redis is active in .env but 'redis-server' was not found in PATH. Celery might fail to connect.\n")
else:
    print("ℹ️  [Info] Redis is commented out in .env. Skipping Redis (falling back to local memory cache).\n")

# 2. PostgreSQL Service
if db_host_active:
    if IS_WINDOWS:
        commands_to_run.append(("PostgreSQL", "net start postgresql-x64-18"))
    else:
        has_systemctl = os.path.exists("/bin/systemctl") or os.path.exists("/usr/bin/systemctl")
        commands_to_run.append(("PostgreSQL", "sudo systemctl start postgresql" if has_systemctl else "echo PostgreSQL assumed running"))
else:
    print("ℹ️  [Info] DB_HOST is commented out in .env. Skipping PostgreSQL (falling back to SQLite database).\n")

# 3. Django Backend
django_cmd = "venv\\Scripts\\python.exe manage.py runserver 0.0.0.0:8000" if IS_WINDOWS else "./venv/bin/python manage.py runserver 0.0.0.0:8000"
commands_to_run.append(("Django Backend", django_cmd))

# 4. Celery Worker (Only run if Redis is active in .env)
if redis_active:
    celery_found = False
    celery_cmd = ""
    if IS_WINDOWS:
        if shutil.which("venv\\Scripts\\celery.exe") or shutil.which("celery"):
            celery_cmd = "venv\\Scripts\\celery.exe -A backend worker --loglevel=info -P solo"
            celery_found = True
    else:
        if os.path.exists("./venv/bin/celery") or shutil.which("celery"):
            celery_cmd = "./venv/bin/celery -A backend worker --loglevel=info"
            celery_found = True
            
    if celery_found:
        commands_to_run.append(("Celery Worker", celery_cmd))
    else:
        print("⚠️  [Warning] Celery was not found in path/virtualenv. Skipping Celery worker.\n")
else:
    print("ℹ️  [Info] Celery is not active in .env. Skipping Celery background workers (using Celery Eager tasks).\n")

# 5. Frontend Static Server
frontend_cmd = "python -m http.server 8080 --directory frontend" if IS_WINDOWS else "python3 -m http.server 8080 --directory frontend"
commands_to_run.append(("Frontend Static", frontend_cmd))

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
        if IS_WINDOWS:
            p = subprocess.Popen(cmd, shell=True)
        else:
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
