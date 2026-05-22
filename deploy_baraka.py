#!/usr/bin/env python3
import subprocess
import sys
import time
import os
import signal
import json
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
LOG_DIR = SCRIPT_DIR / "logs"
PID_DIR = SCRIPT_DIR / ".pids"
VENV_DIR = SCRIPT_DIR / "venv"
GUNICORN = VENV_DIR / "bin" / "gunicorn"
CELERY = VENV_DIR / "bin" / "celery"
PYTHON = VENV_DIR / "bin" / "python"
MANAGE = SCRIPT_DIR / "manage.py"

DJANGO_LOG = LOG_DIR / "django.log"
CELERY_LOG = LOG_DIR / "celery.log"
NGROK_LOG = LOG_DIR / "ngrok.log"
NGINX_ACCESS = Path("/var/log/nginx/access.log")
NGINX_ERROR = Path("/var/log/nginx/error.log")

DJANGO_PID = PID_DIR / "django.pid"
CELERY_PID = PID_DIR / "celery.pid"
NGROK_PID = PID_DIR / "ngrok.pid"

processes = []

def ensure_dirs():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    PID_DIR.mkdir(parents=True, exist_ok=True)

def read_pid(path):
    try:
        return int(path.read_text().strip())
    except (FileNotFoundError, ValueError):
        return None

def is_running(pid):
    if pid is None:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

def pid_status(path):
    pid = read_pid(path)
    if pid is None:
        return "stopped", None
    if is_running(pid):
        return "running", pid
    return "crashed", pid

def write_pid(path, pid):
    path.write_text(str(pid))

def remove_pid(path):
    path.unlink(missing_ok=True)

def print_header(title):
    print()
    print(f"\033[0;36m{'='*73}\033[0m")
    print(f"\033[1m   Baraka Production Service — {title}\033[0m")
    print(f"\033[0;36m{'='*73}\033[0m")
    print()

def step(msg):
    print(f"\033[0;32m{msg}\033[0m")

def warn(msg):
    print(f"\033[1;33m  {msg}\033[0m")

def error(msg):
    print(f"\033[0;31m{msg}\033[0m")

# --- Service Start -----------------------------------------------------------

def start_django():
    ensure_dirs()
    status, pid = pid_status(DJANGO_PID)
    if status == "running":
        warn(f"Django/Gunicorn is already running (PID {pid})")
        return
    if not GUNICORN.exists():
        error("Virtual environment not found! Run 'deploy_baraka.sh deploy' first.")
        return
    step("Starting Django/Gunicorn server in background...")
    cmd = [
        str(GUNICORN), "backend.wsgi:application",
        "--bind", "127.0.0.1:8003",
        "--workers", "4",
        "--threads", "2",
        "--timeout", "120",
        "--access-logfile", str(DJANGO_LOG),
        "--error-logfile", str(DJANGO_LOG),
    ]
    with open(DJANGO_LOG, "a") as log:
        p = subprocess.Popen(cmd, stdout=log, stderr=log, cwd=str(SCRIPT_DIR))
    write_pid(DJANGO_PID, p.pid)
    time.sleep(1)
    if is_running(p.pid):
        print(f"  \033[0;32m●\033[0m Django/Gunicorn started (PID {p.pid})")
    else:
        error("Django/Gunicorn failed to start! Last log lines:")
        lines = DJANGO_LOG.read_text().splitlines()[-10:] if DJANGO_LOG.exists() else []
        for line in lines:
            print(f"    {line}")
        remove_pid(DJANGO_PID)

def start_celery():
    ensure_dirs()
    status, pid = pid_status(CELERY_PID)
    if status == "running":
        warn(f"Celery is already running (PID {pid})")
        return
    if not CELERY.exists():
        error("Virtual environment not found! Run 'deploy_baraka.sh deploy' first.")
        return
    step("Starting Celery worker in background...")
    cmd = [
        str(CELERY), "-A", "backend", "worker",
        "--loglevel=info",
        "--logfile", str(CELERY_LOG),
    ]
    with open(CELERY_LOG, "a") as log:
        p = subprocess.Popen(cmd, stdout=log, stderr=log, cwd=str(SCRIPT_DIR))
    write_pid(CELERY_PID, p.pid)
    time.sleep(1)
    if is_running(p.pid):
        print(f"  \033[0;32m●\033[0m Celery worker started (PID {p.pid})")
    else:
        error("Celery failed to start! Last log lines:")
        lines = CELERY_LOG.read_text().splitlines()[-10:] if CELERY_LOG.exists() else []
        for line in lines:
            print(f"    {line}")
        remove_pid(CELERY_PID)

def start_ngrok():
    ensure_dirs()
    if not shutil_which("ngrok"):
        warn("Ngrok is not installed — skipping.")
        return
    status, pid = pid_status(NGROK_PID)
    if status == "running":
        warn(f"Ngrok is already running (PID {pid})")
        return
    step("Starting Ngrok tunnel in background...")
    cmd = ["ngrok", "http", "80", "--log=stdout"]
    with open(NGROK_LOG, "a") as log:
        p = subprocess.Popen(cmd, stdout=log, stderr=log)
    write_pid(NGROK_PID, p.pid)
    print(f"  \033[0;32m●\033[0m Ngrok tunnel started (PID {p.pid})")
    time.sleep(4)
    api_port = _find_ngrok_api_port()
    if api_port:
        url = _get_ngrok_url(api_port)
        if url:
            print(f"  \033[0;32m\U0001f310\033[0m Ngrok URL: \033[1m{url}\033[0m")
        else:
            print(f"  \033[1;33m\u23f3\033[0m Ngrok URL pending — check: curl -s http://127.0.0.1:{api_port}/api/tunnels")
    else:
        print(f"  \033[1;33m\u23f3\033[0m Ngrok API not ready — check logs: ./deploy_baraka.sh logs ngrok")

def start_nginx():
    if not shutil_which("nginx"):
        warn("Nginx is not installed — skipping.")
        return
    step("Starting Nginx...")
    try:
        subprocess.run(["sudo", "systemctl", "start", "nginx"], check=False)
        print("  \033[0;32m●\033[0m Nginx started")
    except Exception:
        warn("Nginx failed to start via systemctl. Trying nginx directly...")
        try:
            subprocess.run(["sudo", "nginx"], check=True)
            print("  \033[0;32m●\033[0m Nginx started (direct)")
        except Exception:
            error("Could not start Nginx. Check: sudo nginx -t")

def start_all():
    print_header("Starting All Services")
    start_nginx()
    start_django()
    start_celery()
    start_ngrok()
    print()
    print("\033[0;32mAll services started in background.\033[0m")
    print("   Use ./deploy_baraka.py logs <service> to view logs.")
    print("   Use ./deploy_baraka.py status to check service status.")
    print()

# --- Service Stop ------------------------------------------------------------

def kill_pid(path, name):
    pid = read_pid(path)
    if pid is None:
        print(f"  \033[1;33m\u25a0\033[0m {name} is not running (no PID file)")
        return
    if is_running(pid):
        try:
            os.kill(pid, signal.SIGTERM)
            for _ in range(10):
                time.sleep(0.5)
                if not is_running(pid):
                    break
            if is_running(pid):
                os.kill(pid, signal.SIGKILL)
            print(f"  \033[0;31m\u25a0\033[0m {name} stopped (PID {pid})")
        except ProcessLookupError:
            print(f"  \033[1;33m\u25a0\033[0m {name} was not running (stale PID {pid})")
    else:
        print(f"  \033[1;33m\u25a0\033[0m {name} was not running (stale PID {pid})")
    remove_pid(path)

def stop_django():
    kill_pid(DJANGO_PID, "Django/Gunicorn")

def stop_celery():
    kill_pid(CELERY_PID, "Celery")

def stop_ngrok():
    kill_pid(NGROK_PID, "Ngrok")

def stop_nginx():
    if not shutil_which("nginx"):
        return
    print("  \033[0;31m\u25a0\033[0m Stopping Nginx...")
    subprocess.run(["sudo", "systemctl", "stop", "nginx"], stderr=subprocess.DEVNULL, check=False)
    print("  \033[0;31m\u25a0\033[0m Nginx stopped")

def stop_all():
    print_header("Stopping All Services")
    stop_ngrok()
    stop_celery()
    stop_django()
    stop_nginx()
    print()
    print("\033[0;31mAll services stopped.\033[0m")
    print()

# --- Service Status ----------------------------------------------------------

def _find_ngrok_api_port():
    for port in range(4040, 4045):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/tunnels", timeout=1):
                return port
        except Exception:
            continue
    return None

def _get_ngrok_url(port):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/tunnels", timeout=2) as r:
            data = json.loads(r.read().decode())
            return data["tunnels"][0]["public_url"]
    except Exception:
        return None

def check_status():
    print_header("Service Status")

    # Nginx
    if not shutil_which("nginx"):
        print(f"  \033[1;33m\u25cf\033[0m Nginx          — \033[1;33mNot Installed\033[0m")
    elif subprocess.run(["systemctl", "is-active", "--quiet", "nginx"], stderr=subprocess.DEVNULL).returncode == 0:
        print(f"  \033[0;32m\u25cf\033[0m Nginx          — \033[0;32mRunning\033[0m")
    else:
        print(f"  \033[0;31m\u25cf\033[0m Nginx          — \033[0;31mStopped\033[0m")

    # Django
    st, pid = pid_status(DJANGO_PID)
    if st == "running":
        print(f"  \033[0;32m\u25cf\033[0m Django/Gunicorn — \033[0;32mRunning\033[0m (PID {pid})")
    elif st == "crashed":
        print(f"  \033[1;33m\u25cf\033[0m Django/Gunicorn — \033[1;33mCrashed\033[0m (stale PID) — check: ./deploy_baraka.py logs django")
    else:
        print(f"  \033[0;31m\u25cf\033[0m Django/Gunicorn — \033[0;31mStopped\033[0m")

    # Celery
    st, pid = pid_status(CELERY_PID)
    if st == "running":
        print(f"  \033[0;32m\u25cf\033[0m Celery         — \033[0;32mRunning\033[0m (PID {pid})")
    elif st == "crashed":
        print(f"  \033[1;33m\u25cf\033[0m Celery         — \033[1;33mCrashed\033[0m (stale PID) — check: ./deploy_baraka.py logs celery")
    else:
        print(f"  \033[0;31m\u25cf\033[0m Celery         — \033[0;31mStopped\033[0m")

    # Ngrok
    st, pid = pid_status(NGROK_PID)
    if st == "running":
        api_port = _find_ngrok_api_port()
        url = _get_ngrok_url(api_port) if api_port else "N/A"
        print(f"  \033[0;32m\u25cf\033[0m Ngrok          — \033[0;32mRunning\033[0m (PID {pid}) → \033[1m{url}\033[0m")
    elif st == "crashed":
        print(f"  \033[1;33m\u25cf\033[0m Ngrok          — \033[1;33mCrashed\033[0m (stale PID) — check: ./deploy_baraka.py logs ngrok")
    else:
        print(f"  \033[0;31m\u25cf\033[0m Ngrok          — \033[0;31mStopped\033[0m")

    # Redis
    r = subprocess.run(["systemctl", "is-active", "--quiet", "redis-server"], stderr=subprocess.DEVNULL).returncode
    if r == 0 or shutil_which("redis-server"):
        print(f"  \033[0;32m\u25cf\033[0m Redis          — \033[0;32mRunning\033[0m")
    else:
        print(f"  \033[0;31m\u25cf\033[0m Redis          — \033[0;31mStopped\033[0m")

    # PostgreSQL
    r = subprocess.run(["systemctl", "is-active", "--quiet", "postgresql"], stderr=subprocess.DEVNULL).returncode
    if r == 0:
        print(f"  \033[0;32m\u25cf\033[0m PostgreSQL     — \033[0;32mRunning\033[0m")
    else:
        print(f"  \033[0;31m\u25cf\033[0m PostgreSQL     — \033[0;31mStopped\033[0m")

    print()

# --- Logs --------------------------------------------------------------------

def show_logs(service, lines=50):
    log_files = {
        "django": DJANGO_LOG,
        "gunicorn": DJANGO_LOG,
        "backend": DJANGO_LOG,
        "celery": CELERY_LOG,
        "worker": CELERY_LOG,
        "ngrok": NGROK_LOG,
        "tunnel": NGROK_LOG,
        "frontend": None,
        "nginx": None,
        "web": None,
    }

    if service == "all":
        print_header("All Service Logs (combined)")
        files = [f for f in [DJANGO_LOG, CELERY_LOG, NGROK_LOG] if f.exists()]
        try:
            subprocess.run(["tail", "-f", "-n", str(lines)] + files, check=False)
        except KeyboardInterrupt:
            pass
        return

    if service in ("frontend", "nginx", "web"):
        print_header("Nginx/Frontend Logs")
        files = [f for f in [NGINX_ACCESS, NGINX_ERROR] if f.exists()]
        if not files:
            error("No Nginx logs found. Is Nginx running?")
            return
        try:
            subprocess.run(["sudo", "tail", "-f", "-n", str(lines)] + files, check=False)
        except KeyboardInterrupt:
            pass
        return

    log = log_files.get(service)
    if log is None:
        error(f"Unknown service: '{service}'")
        print()
        print("  Available services: django, celery, frontend, ngrok, all")
        print("  Usage: ./deploy_baraka.py logs <service>")
        return

    if log.exists():
        print_header(f"{service.capitalize()} Logs")
        try:
            subprocess.run(["tail", "-f", "-n", str(lines), str(log)], check=False)
        except KeyboardInterrupt:
            pass
    else:
        error(f"No {service.capitalize()} logs found. Is the service running?")
        print(f"  Expected log file: {log}")

# --- Shell Command Delegation ------------------------------------------------

def run_shell(command):
    script = SCRIPT_DIR / "deploy_baraka.sh"
    if not script.exists():
        error("deploy_baraka.sh not found!")
        return
    os.execv("/bin/bash", ["bash", str(script), command])

# --- Main Entry Point --------------------------------------------------------

def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("help", "-h", "--help"):
        print()
        print("\033[1mBaraka Deployment Script (Python)\033[0m")
        print()
        print("Usage: ./deploy_baraka.py [command]")
        print()
        print("Commands:")
        print("  \033[0;36mdeploy\033[0m              Full deployment (install deps + configure + start)")
        print("  \033[0;36mbaraka\033[0m              First-time Postgres setup (user, db, migrations)")
        print("  \033[0;36mstart\033[0m               Start all background services")
        print("  \033[0;36mstop\033[0m                Stop all background services")
        print("  \033[0;36mrestart\033[0m             Restart all background services")
        print("  \033[0;36mstatus\033[0m              Show status of all services")
        print("  \033[0;36mlogs <service>\033[0m      Tail logs for a service")
        print("  \033[0;36mhelp\033[0m                Show this help message")
        print()
        return

    command = sys.argv[1]
    service = sys.argv[2] if len(sys.argv) > 2 else None

    if command in ("deploy", "install", "setup", "baraka"):
        run_shell(command)

    elif command == "start":
        start_all()

    elif command == "stop":
        stop_all()

    elif command == "restart":
        stop_all()
        start_all()

    elif command == "status":
        check_status()

    elif command in ("logs", "log"):
        if not service:
            error("Please specify a service to view logs for.")
            print()
            print("  Usage: ./deploy_baraka.py logs <service>")
            print()
            print("  Available services: django, celery, frontend, ngrok, all")
            sys.exit(1)
        show_logs(service)

    else:
        error(f"Unknown command: '{command}'")
        print(f"  Run \033[0;36m./deploy_baraka.py help\033[0m to see available commands.")
        sys.exit(1)


def shutil_which(cmd):
    return subprocess.run(["which", cmd], capture_output=True).returncode == 0


if __name__ == "__main__":
    main()
