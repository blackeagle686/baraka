#!/bin/bash
# ==============================================================================
#   🚀 Baraka Delivery SaaS Platform — Production Server Deployment Script
#   Target OS: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
# ==============================================================================

set -e # Exit immediately on error

echo "========================================================================="
echo "   🔥 Starting Baraka Production Service Deployment (Ubuntu/Debian)"
echo "========================================================================="
echo ""

# 1. System Package Updates
echo "🔄 [1/9] Updating Ubuntu System Package Repository..."
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Dependency Installation
echo "📦 [2/9] Installing Core Dependencies (Python, PostgreSQL, Redis, Nginx, Git)..."
sudo apt-get install -y python3-pip python3-venv postgresql postgresql-contrib redis-server nginx git curl libpq-dev build-essential

# 3. Redis & PostgreSQL Auto-Start
echo "⚡ [3/9] Starting and configuring core system services..."
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 4. PostgreSQL Database Creation
echo "🗄️ [4/9] Setting up PostgreSQL production database 'baraka'..."
# Create db if not present and alter default postgres password
sudo -u postgres psql -c "CREATE DATABASE baraka;" || echo "Database already exists"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'barakasecurepass';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE baraka TO postgres;"

# 5. Virtual Environment & Dependencies
echo "🐍 [5/9] Setting up Python virtual environment & package adapters..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# 6. Environment Configurations
echo "📝 [6/9] Assuring Production Environment Variables (.env)..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    # Activate production PostgreSQL inside .env
    sed -i 's/DB_HOST=/DB_HOST=127.0.0.1/g' .env
    sed -i 's/REDIS_URL=/REDIS_URL=redis:\/\/127.0.0.1:6379\/1/g' .env
    sed -i 's/CELERY_BROKER_URL=/CELERY_BROKER_URL=redis:\/\/127.0.0.1:6379\/1/g' .env
    sed -i 's/ALLOWED_HOSTS=/ALLOWED_HOSTS=*,/g' .env
    echo "✅ Generated standard production .env file."
fi

# 7. Django DB Migrations & Static Files
echo "🚀 [7/9] Running schema migrations and building production tables..."
./venv/bin/python manage.py migrate
./venv/bin/python manage.py collectstatic --noinput

# 8. Setup Nginx Reverse Proxy
echo "🌐 [8/9] Configuring Nginx web server for Reverse Proxy..."
# Grant execute permissions to parent directories so Nginx can traverse and serve frontend files
chmod o+x $(pwd) || true
chmod o+x $(dirname $(pwd)) || true

NGINX_CONF="/etc/nginx/sites-available/baraka"
sudo tee $NGINX_CONF > /dev/null <<EOF
server {
    listen 80;
    server_name _; # Replace with your domain name or public IP

    # Static Frontend
    location / {
        root $(pwd)/frontend;
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

# Activate site and restart nginx
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default || true
sudo systemctl restart nginx

# 9. Systemd Daemon Services Configuration
echo "⚙️ [9/9] Creating Systemd services for Gunicorn and Celery..."

# Identify actual non-root user running the deployment
RUN_USER=${SUDO_USER:-$USER}

# Create Gunicorn Systemd Service
sudo tee /etc/systemd/system/baraka-backend.service > /dev/null <<EOF
[Unit]
Description=Gunicorn daemon for Baraka Backend API
After=network.target

[Service]
User=$RUN_USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/venv/bin/gunicorn backend.wsgi:application --bind 127.0.0.1:8000 --workers 4 --threads 2 --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Create Celery Systemd Service
sudo tee /etc/systemd/system/baraka-celery.service > /dev/null <<EOF
[Unit]
Description=Celery Worker for Baraka Background Tasks
After=network.target redis-server.service

[Service]
User=$RUN_USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/venv/bin/celery -A backend worker --loglevel=info
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Reload and launch services
sudo systemctl daemon-reload
sudo systemctl restart baraka-backend
sudo systemctl enable baraka-backend
sudo systemctl restart baraka-celery
sudo systemctl enable baraka-celery

# 10. Install & Configure Ngrok Tunnel
echo "🚇 [10/10] Installing and configuring Ngrok Tunnel..."
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt-get update -y
sudo apt-get install -y ngrok

# Configure ngrok auth token for root (since systemd service runs as root)
sudo ngrok config add-authtoken 32oqG1HkcJP4KusIL9KIzUmLaLk_QjDFtKmxQpDXjNwoNJZQ

# Create Ngrok Systemd Service
sudo tee /etc/systemd/system/ngrok.service > /dev/null <<EOF
[Unit]
Description=ngrok tunnel for Baraka (Port 80)
After=network.target nginx.service

[Service]
ExecStart=/usr/bin/ngrok http 80 --log=stdout
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

# Enable and start ngrok service
sudo systemctl daemon-reload
sudo systemctl enable ngrok
sudo systemctl restart ngrok

# Wait for ngrok tunnel to be created and fetch url
echo "⏳ Waiting for Ngrok tunnel to spin up..."
sleep 5
NGROK_URL=\$(python3 -c "import urllib.request, json; print(json.loads(urllib.request.urlopen('http://127.0.0.1:4040/api/tunnels').read().decode())['tunnels'][0]['public_url'])" 2>/dev/null || echo "Pending (check with 'curl http://127.0.0.1:4040/api/tunnels')")

echo ""
echo "========================================================================="
echo "   ✨ Baraka SaaS Platform Deployment Completed Successfully!"
echo "   🌎 Access your app on port 80 (http://your_server_ip)"
echo "   🚇 Ngrok Live Tunnel URL: \$NGROK_URL"
echo "   🔗 API Backend is running under reverse proxy at /api/"
echo "   📦 Celery Background worker is active and listening for tasks!"
echo "========================================================================="
echo ""
