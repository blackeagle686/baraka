#!/bin/bash
# ==============================================================================
#   🚀 Baraka Delivery SaaS Platform — Production Server Deployment Script
#   Target OS: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
#
#   Usage:
#     ./deploy.sh                  — Full deployment (install + start all)
#     ./deploy.sh start            — Start all background services
#     ./deploy.sh stop             — Stop all background services
#     ./deploy.sh restart          — Restart all background services
#     ./deploy.sh status           — Show status of all services
#     ./deploy.sh logs django      — Tail Django/Gunicorn logs
#     ./deploy.sh logs celery      — Tail Celery worker logs
#     ./deploy.sh logs frontend    — Tail Nginx/frontend logs
#     ./deploy.sh logs ngrok       — Tail Ngrok tunnel logs
#     ./deploy.sh logs all         — Tail all logs combined
# ==============================================================================

# --- Configuration -----------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
PID_DIR="$SCRIPT_DIR/.pids"

DJANGO_LOG="$LOG_DIR/django.log"
CELERY_LOG="$LOG_DIR/celery.log"
NGROK_LOG="$LOG_DIR/ngrok.log"
NGINX_ACCESS_LOG="/var/log/nginx/access.log"
NGINX_ERROR_LOG="/var/log/nginx/error.log"

DJANGO_PID="$PID_DIR/django.pid"
CELERY_PID="$PID_DIR/celery.pid"
NGROK_PID="$PID_DIR/ngrok.pid"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# --- Helper Functions --------------------------------------------------------

ensure_dirs() {
    mkdir -p "$LOG_DIR" "$PID_DIR"
}

print_header() {
    echo ""
    echo -e "${CYAN}=========================================================================${NC}"
    echo -e "${BOLD}   🔥 Baraka Production Service — $1${NC}"
    echo -e "${CYAN}=========================================================================${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}$1${NC}"
}

print_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

is_running() {
    local pidfile="$1"
    if [ -f "$pidfile" ]; then
        local pid
        pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

kill_pid() {
    local pidfile="$1"
    local name="$2"
    if [ -f "$pidfile" ]; then
        local pid
        pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            # Wait up to 5 seconds for graceful shutdown
            for i in $(seq 1 10); do
                if ! kill -0 "$pid" 2>/dev/null; then
                    break
                fi
                sleep 0.5
            done
            # Force kill if still alive
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null
            fi
            echo -e "  ${RED}■${NC} $name stopped (PID $pid)"
        else
            echo -e "  ${YELLOW}■${NC} $name was not running (stale PID $pid)"
        fi
        rm -f "$pidfile"
    else
        echo -e "  ${YELLOW}■${NC} $name is not running (no PID file)"
    fi
}

# --- Service Start -----------------------------------------------------------

start_django() {
    ensure_dirs
    if is_running "$DJANGO_PID"; then
        print_warn "Django/Gunicorn is already running (PID $(cat "$DJANGO_PID"))"
        return
    fi
    print_step "🚀 Starting Django/Gunicorn server in background..."
    cd "$SCRIPT_DIR"
    nohup ./venv/bin/gunicorn backend.wsgi:application \
        --bind 127.0.0.1:8000 \
        --workers 4 \
        --threads 2 \
        --timeout 120 \
        --access-logfile "$DJANGO_LOG" \
        --error-logfile "$DJANGO_LOG" \
        >> "$DJANGO_LOG" 2>&1 &
    local DJPID=$!
    echo "$DJPID" > "$DJANGO_PID"
    sleep 1
    if kill -0 "$DJPID" 2>/dev/null; then
        echo -e "  ${GREEN}●${NC} Django/Gunicorn started (PID $DJPID)"
    else
        print_error "Django/Gunicorn failed to start! Last log lines:"
        tail -n 10 "$DJANGO_LOG" 2>/dev/null | sed 's/^/    /'
        rm -f "$DJANGO_PID"
    fi
}

start_celery() {
    ensure_dirs
    if is_running "$CELERY_PID"; then
        print_warn "Celery is already running (PID $(cat "$CELERY_PID"))"
        return
    fi
    print_step "📦 Starting Celery worker in background..."
    cd "$SCRIPT_DIR"
    nohup ./venv/bin/celery -A backend worker \
        --loglevel=info \
        --logfile="$CELERY_LOG" \
        >> "$CELERY_LOG" 2>&1 &
    local CLPID=$!
    echo "$CLPID" > "$CELERY_PID"
    sleep 1
    if kill -0 "$CLPID" 2>/dev/null; then
        echo -e "  ${GREEN}●${NC} Celery worker started (PID $CLPID)"
    else
        print_error "Celery failed to start! Last log lines:"
        tail -n 10 "$CELERY_LOG" 2>/dev/null | sed 's/^/    /'
        rm -f "$CELERY_PID"
    fi
}

start_ngrok() {
    ensure_dirs
    if is_running "$NGROK_PID"; then
        print_warn "Ngrok is already running (PID $(cat "$NGROK_PID"))"
        return
    fi
    print_step "🚇 Starting Ngrok tunnel in background..."
    nohup ngrok http 80 --log=stdout >> "$NGROK_LOG" 2>&1 &
    echo $! > "$NGROK_PID"
    echo -e "  ${GREEN}●${NC} Ngrok tunnel started (PID $!)"

    # Wait a moment and try to grab the public URL
    sleep 4
    NGROK_URL=$(python3 -c "import urllib.request, json; print(json.loads(urllib.request.urlopen('http://127.0.0.1:4040/api/tunnels').read().decode())['tunnels'][0]['public_url'])" 2>/dev/null || echo "")
    if [ -n "$NGROK_URL" ]; then
        echo -e "  ${GREEN}🌐${NC} Ngrok URL: ${BOLD}$NGROK_URL${NC}"
    else
        echo -e "  ${YELLOW}⏳${NC} Ngrok URL pending — check with: ${CYAN}curl -s http://127.0.0.1:4040/api/tunnels${NC}"
    fi
}

start_nginx() {
    if ! command -v nginx &>/dev/null; then
        print_warn "Nginx is not installed — skipping. (Run: sudo apt-get install -y nginx)"
        return
    fi
    print_step "🌐 Starting Nginx..."
    if sudo systemctl start nginx 2>/dev/null; then
        echo -e "  ${GREEN}●${NC} Nginx started"
    else
        print_warn "Nginx failed to start via systemctl. Trying nginx directly..."
        if sudo nginx 2>/dev/null; then
            echo -e "  ${GREEN}●${NC} Nginx started (direct)"
        else
            print_error "Could not start Nginx. Check: sudo nginx -t"
        fi
    fi
}

start_all() {
    print_header "Starting All Services"
    start_nginx
    start_django
    start_celery
    start_ngrok
    echo ""
    echo -e "${GREEN}✅ All services started in background.${NC}"
    echo -e "   Use ${CYAN}./deploy.sh logs <service>${NC} to view logs."
    echo -e "   Use ${CYAN}./deploy.sh status${NC} to check service status."
    echo ""
}

# --- Service Stop ------------------------------------------------------------

stop_django() {
    kill_pid "$DJANGO_PID" "Django/Gunicorn"
}

stop_celery() {
    kill_pid "$CELERY_PID" "Celery"
}

stop_ngrok() {
    kill_pid "$NGROK_PID" "Ngrok"
}

stop_nginx() {
    if ! command -v nginx &>/dev/null; then
        return
    fi
    echo -e "  ${RED}■${NC} Stopping Nginx..."
    sudo systemctl stop nginx 2>/dev/null || sudo nginx -s stop 2>/dev/null || true
    echo -e "  ${RED}■${NC} Nginx stopped"
}

stop_all() {
    print_header "Stopping All Services"
    stop_ngrok
    stop_celery
    stop_django
    stop_nginx
    echo ""
    echo -e "${RED}🛑 All services stopped.${NC}"
    echo ""
}

# --- Service Status ----------------------------------------------------------

# Returns status label: Running, Stopped, or Crashed (pid file exists but process dead)
_pid_status() {
    local pidfile="$1"
    if [ ! -f "$pidfile" ]; then
        echo "Stopped"
    elif kill -0 "$(cat "$pidfile")" 2>/dev/null; then
        echo "Running"
    else
        echo "Crashed"
    fi
}

check_status() {
    print_header "Service Status"

    # Nginx
    if ! command -v nginx &>/dev/null; then
        echo -e "  ${YELLOW}●${NC} Nginx          — ${YELLOW}Not Installed${NC}"
    elif systemctl is-active --quiet nginx 2>/dev/null || pgrep -x nginx &>/dev/null; then
        echo -e "  ${GREEN}●${NC} Nginx          — ${GREEN}Running${NC}"
    else
        echo -e "  ${RED}●${NC} Nginx          — ${RED}Stopped${NC}"
    fi

    # Django
    local djstatus; djstatus=$(_pid_status "$DJANGO_PID")
    case "$djstatus" in
        Running) echo -e "  ${GREEN}●${NC} Django/Gunicorn — ${GREEN}Running${NC} (PID $(cat "$DJANGO_PID"))" ;;
        Crashed) echo -e "  ${YELLOW}●${NC} Django/Gunicorn — ${YELLOW}Crashed${NC} (stale PID) — check: ./deploy_baraka.sh logs django" ;;
        *)       echo -e "  ${RED}●${NC} Django/Gunicorn — ${RED}Stopped${NC}" ;;
    esac

    # Celery
    local clstatus; clstatus=$(_pid_status "$CELERY_PID")
    case "$clstatus" in
        Running) echo -e "  ${GREEN}●${NC} Celery         — ${GREEN}Running${NC} (PID $(cat "$CELERY_PID"))" ;;
        Crashed) echo -e "  ${YELLOW}●${NC} Celery         — ${YELLOW}Crashed${NC} (stale PID) — check: ./deploy_baraka.sh logs celery" ;;
        *)       echo -e "  ${RED}●${NC} Celery         — ${RED}Stopped${NC}" ;;
    esac

    # Ngrok
    local nkstatus; nkstatus=$(_pid_status "$NGROK_PID")
    case "$nkstatus" in
        Running)
            local ngrok_url
            ngrok_url=$(python3 -c "import urllib.request, json; print(json.loads(urllib.request.urlopen('http://127.0.0.1:4040/api/tunnels').read().decode())['tunnels'][0]['public_url'])" 2>/dev/null || echo "N/A")
            echo -e "  ${GREEN}●${NC} Ngrok          — ${GREEN}Running${NC} (PID $(cat "$NGROK_PID")) → ${BOLD}$ngrok_url${NC}"
            ;;
        Crashed) echo -e "  ${YELLOW}●${NC} Ngrok          — ${YELLOW}Crashed${NC} (stale PID) — check: ./deploy_baraka.sh logs ngrok" ;;
        *)       echo -e "  ${RED}●${NC} Ngrok          — ${RED}Stopped${NC}" ;;
    esac

    # Redis
    if systemctl is-active --quiet redis-server 2>/dev/null || pgrep -x redis-server &>/dev/null; then
        echo -e "  ${GREEN}●${NC} Redis          — ${GREEN}Running${NC}"
    else
        echo -e "  ${RED}●${NC} Redis          — ${RED}Stopped${NC}"
    fi

    # PostgreSQL
    if systemctl is-active --quiet postgresql 2>/dev/null || pgrep -x postgres &>/dev/null; then
        echo -e "  ${GREEN}●${NC} PostgreSQL     — ${GREEN}Running${NC}"
    else
        echo -e "  ${RED}●${NC} PostgreSQL     — ${RED}Stopped${NC}"
    fi

    echo ""
}

# --- Logs --------------------------------------------------------------------

show_logs() {
    local service="$1"
    local lines="${2:-50}"

    case "$service" in
        django|gunicorn|backend)
            if [ -f "$DJANGO_LOG" ]; then
                print_header "Django/Gunicorn Logs"
                tail -f -n "$lines" "$DJANGO_LOG"
            else
                print_error "No Django logs found. Is the service running?"
                echo "  Expected log file: $DJANGO_LOG"
            fi
            ;;
        celery|worker)
            if [ -f "$CELERY_LOG" ]; then
                print_header "Celery Worker Logs"
                tail -f -n "$lines" "$CELERY_LOG"
            else
                print_error "No Celery logs found. Is the service running?"
                echo "  Expected log file: $CELERY_LOG"
            fi
            ;;
        frontend|nginx|web)
            print_header "Nginx/Frontend Logs"
            if [ -f "$NGINX_ACCESS_LOG" ] && [ -f "$NGINX_ERROR_LOG" ]; then
                sudo tail -f -n "$lines" "$NGINX_ACCESS_LOG" "$NGINX_ERROR_LOG"
            elif [ -f "$NGINX_ACCESS_LOG" ]; then
                sudo tail -f -n "$lines" "$NGINX_ACCESS_LOG"
            elif [ -f "$NGINX_ERROR_LOG" ]; then
                sudo tail -f -n "$lines" "$NGINX_ERROR_LOG"
            else
                print_error "No Nginx logs found. Is Nginx running?"
            fi
            ;;
        ngrok|tunnel)
            if [ -f "$NGROK_LOG" ]; then
                print_header "Ngrok Tunnel Logs"
                tail -f -n "$lines" "$NGROK_LOG"
            else
                print_error "No Ngrok logs found. Is the tunnel running?"
                echo "  Expected log file: $NGROK_LOG"
            fi
            ;;
        all)
            print_header "All Service Logs (combined)"
            tail -f -n "$lines" \
                "$DJANGO_LOG" \
                "$CELERY_LOG" \
                "$NGROK_LOG" \
                2>/dev/null &
            TAIL_PID=$!
            sudo tail -f -n "$lines" \
                "$NGINX_ACCESS_LOG" \
                "$NGINX_ERROR_LOG" \
                2>/dev/null &
            NGINX_TAIL_PID=$!
            # Trap Ctrl+C to kill both tail processes
            trap "kill $TAIL_PID $NGINX_TAIL_PID 2>/dev/null; exit 0" INT
            wait
            ;;
        *)
            print_error "Unknown service: '$service'"
            echo ""
            echo "  Available services:"
            echo -e "    ${CYAN}django${NC}    — Django/Gunicorn backend logs"
            echo -e "    ${CYAN}celery${NC}    — Celery background worker logs"
            echo -e "    ${CYAN}frontend${NC}  — Nginx access & error logs"
            echo -e "    ${CYAN}ngrok${NC}     — Ngrok tunnel logs"
            echo -e "    ${CYAN}all${NC}       — All logs combined"
            echo ""
            echo "  Usage: ./deploy.sh logs <service>"
            exit 1
            ;;
    esac
}

# --- Full Deployment (Install + Setup) --------------------------------------

full_deploy() {
    set -e
    print_header "Full Deployment (Install + Start)"

    # 1. System Package Updates
    print_step "🔄 [1/10] Updating Ubuntu System Package Repository..."
    sudo apt-get update -y

    # 2. Dependency Installation
    print_step "📦 [2/10] Installing Core Dependencies (Python, PostgreSQL, Redis, Nginx, Git)..."
    sudo apt-get install -y python3-pip python3-venv postgresql postgresql-contrib redis-server nginx git curl libpq-dev build-essential

    # 3. Redis & PostgreSQL Auto-Start
    print_step "⚡ [3/10] Starting and configuring core system services..."
    sudo systemctl enable redis-server
    sudo systemctl start redis-server
    sudo systemctl enable postgresql
    sudo systemctl start postgresql

    # 4. PostgreSQL Database Creation
    print_step "🗄️  [4/10] Setting up PostgreSQL production database 'baraka'..."
    sudo -u postgres psql -c "CREATE DATABASE baraka;" 2>/dev/null || echo "  Database already exists"
    sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'barakasecurepass';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE baraka TO postgres;"

    # 5. Virtual Environment & Dependencies
    print_step "🐍 [5/10] Setting up Python virtual environment & packages..."
    cd "$SCRIPT_DIR"
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt

    # 6. Environment Configurations
    print_step "📝 [6/10] Assuring Production Environment Variables (.env)..."
    if [ ! -f ".env" ]; then
        cp .env.example .env
        sed -i 's/DB_HOST=/DB_HOST=127.0.0.1/g' .env
        sed -i 's/REDIS_URL=/REDIS_URL=redis:\/\/127.0.0.1:6379\/1/g' .env
        sed -i 's/CELERY_BROKER_URL=/CELERY_BROKER_URL=redis:\/\/127.0.0.1:6379\/1/g' .env
        sed -i 's/ALLOWED_HOSTS=/ALLOWED_HOSTS=*,/g' .env
        echo "  ✅ Generated standard production .env file."
    fi

    # 7. Django DB Migrations & Static Files
    print_step "🚀 [7/10] Running schema migrations and building production tables..."
    ./venv/bin/python manage.py migrate
    ./venv/bin/python manage.py collectstatic --noinput

    # 8. Setup Nginx Reverse Proxy
    print_step "🌐 [8/10] Configuring Nginx web server for Reverse Proxy..."
    chmod o+x "$SCRIPT_DIR" || true
    chmod o+x "$(dirname "$SCRIPT_DIR")" || true

    NGINX_CONF="/etc/nginx/sites-available/baraka"
    sudo tee $NGINX_CONF > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    # Static Frontend
    location / {
        root $SCRIPT_DIR/frontend;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # API Backend Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Media Files Proxy
    location /media/ {
        proxy_pass http://127.0.0.1:8000/media/;
        proxy_set_header Host \$host;
    }
}
EOF

    sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default || true
    sudo systemctl restart nginx

    # 9. Install & Configure Ngrok
    print_step "🚇 [9/10] Installing and configuring Ngrok Tunnel..."
    if ! command -v ngrok &> /dev/null; then
        curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
        echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
        sudo apt-get update -y
        sudo apt-get install -y ngrok
    else
        echo "  Ngrok is already installed."
    fi

    # Prompt user for ngrok auth token
    echo ""
    echo -e "${CYAN}🔑 Ngrok Authentication${NC}"
    echo -e "   Get your token from: ${BOLD}https://dashboard.ngrok.com/get-started/your-authtoken${NC}"
    echo ""
    read -rp "   Enter your Ngrok auth token: " NGROK_TOKEN
    if [ -z "$NGROK_TOKEN" ]; then
        print_warn "No Ngrok token provided. Skipping Ngrok auth configuration."
        print_warn "You can configure it later with: ngrok config add-authtoken YOUR_TOKEN"
    else
        ngrok config add-authtoken "$NGROK_TOKEN"
        echo -e "  ${GREEN}✅${NC} Ngrok auth token configured."
    fi

    # 10. Start all services in background
    print_step "⚙️  [10/10] Starting all services in background..."
    ensure_dirs
    start_nginx
    start_django
    start_celery
    start_ngrok

    echo ""
    echo -e "${CYAN}=========================================================================${NC}"
    echo -e "${BOLD}   ✨ Baraka SaaS Platform Deployment Completed Successfully!${NC}"
    echo -e "${CYAN}=========================================================================${NC}"
    echo ""
    echo -e "   ${GREEN}●${NC} All services are running in the background"
    echo ""
    echo -e "   ${BOLD}Commands:${NC}"
    echo -e "     ${CYAN}./deploy.sh status${NC}           — Check all service statuses"
    echo -e "     ${CYAN}./deploy.sh logs django${NC}      — View Django logs"
    echo -e "     ${CYAN}./deploy.sh logs celery${NC}      — View Celery logs"
    echo -e "     ${CYAN}./deploy.sh logs frontend${NC}    — View Nginx logs"
    echo -e "     ${CYAN}./deploy.sh logs ngrok${NC}       — View Ngrok logs"
    echo -e "     ${CYAN}./deploy.sh logs all${NC}         — View all logs"
    echo -e "     ${CYAN}./deploy.sh stop${NC}             — Stop all services"
    echo -e "     ${CYAN}./deploy.sh restart${NC}          — Restart all services"
    echo ""
}

# --- Main Entry Point --------------------------------------------------------

COMMAND="${1:-deploy}"
SERVICE="$2"

case "$COMMAND" in
    deploy|install|setup)
        full_deploy
        ;;
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        start_all
        ;;
    status)
        check_status
        ;;
    logs|log)
        if [ -z "$SERVICE" ]; then
            print_error "Please specify a service to view logs for."
            echo ""
            echo "  Usage: ./deploy.sh logs <service>"
            echo ""
            echo "  Available services:"
            echo -e "    ${CYAN}django${NC}    — Django/Gunicorn backend logs"
            echo -e "    ${CYAN}celery${NC}    — Celery background worker logs"
            echo -e "    ${CYAN}frontend${NC}  — Nginx access & error logs"
            echo -e "    ${CYAN}ngrok${NC}     — Ngrok tunnel logs"
            echo -e "    ${CYAN}all${NC}       — All logs combined"
            exit 1
        fi
        show_logs "$SERVICE"
        ;;
    help|-h|--help)
        echo ""
        echo -e "${BOLD}Baraka Deployment Script${NC}"
        echo ""
        echo "Usage: ./deploy.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo -e "  ${CYAN}deploy${NC}              Full deployment (install deps + configure + start)"
        echo -e "  ${CYAN}start${NC}               Start all background services"
        echo -e "  ${CYAN}stop${NC}                Stop all background services"
        echo -e "  ${CYAN}restart${NC}             Restart all background services"
        echo -e "  ${CYAN}status${NC}              Show status of all services"
        echo -e "  ${CYAN}logs <service>${NC}      Tail logs for a service (django|celery|frontend|ngrok|all)"
        echo -e "  ${CYAN}help${NC}                Show this help message"
        echo ""
        ;;
    *)
        print_error "Unknown command: '$COMMAND'"
        echo "  Run ${CYAN}./deploy.sh help${NC} to see available commands."
        exit 1
        ;;
esac
