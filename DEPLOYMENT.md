# 🚀 Baraka Production Deployment & Containerization Guide

Welcome to the **Baraka** Deployment Guide! This document provides detailed, step-by-step instructions on how to build, run, scale, and monitor your fully containerized high-concurrency architecture using **Docker** and **Docker Compose**.

---

## 📋 System Requirements

Ensure you have the following installed on your host system:
*   **Docker** (v20.10.0 or higher)
*   **Docker Compose** (v2.0.0 or higher)

---

## 🛠️ Step-by-Step Deployment Instructions

### Step 1: Clone & Navigate to the Project
Open your terminal and navigate to the root folder of the project:
```bash
cd c:\Users\The_Last_King\OneDrive\Documents\Projects\baraka
```

### Step 2: Build & Start All Services
Run the following command to build all required container images (Django backend, Nginx frontend, Celery worker) and start all containers in detached mode (background):
```bash
docker compose up --build -d
```
> [!NOTE]
> *   On first run, Docker will download the baseline PostgreSQL, Redis, Python, and Nginx images.
> *   The Gunicorn backend container will automatically run the Django database migrations (`python manage.py migrate`) on startup, preparing your PostgreSQL schema instantly.

---

## 📂 Auto-Configured Production Services

Once running, your infrastructure maps exactly as follows:

| Container Name | Service | Role | Internal Port | External Port |
| :--- | :--- | :--- | :--- | :--- |
| **`baraka_db`** | PostgreSQL 15 | Persistent Relational Database Storage | `5432` | `5432` (Hosts local clients) |
| **`baraka_redis`** | Redis Alpine | High-Speed Cache & Celery Task Queue Broker | `6379` | `6379` |
| **`baraka_backend`** | Django Gunicorn | ASGI Web Application Thread Pools | `8000` | `8000` (API direct log testing) |
| **`baraka_celery_worker`**| Celery Worker | Asynchronous Background Tasks Execution | N/A | N/A |
| **`baraka_frontend`** | Nginx Reverse Proxy | Serve Static Assets & Route API/Media calls | `80` | `8080` (Main Entry Point) |

---

## 🎮 Essential Management Commands

### 1. Check Service Status
Verify that all containers are healthy, running, and mapping their ports correctly:
```bash
docker compose ps
```

### 2. Monitor Container Logs (Real Time)
Watch Gunicorn request logging and see the Celery background worker dispatching alerts in real time:
```bash
docker compose logs -f
```
You can also follow logs for a single service (e.g., Celery worker only):
```bash
docker compose logs -f celery_worker
```

### 3. Create a Django Superuser inside Docker
To access the Django Admin Portal (`http://localhost:8080/admin/` or `http://localhost:8000/admin/`), run:
```bash
docker compose exec backend python manage.py createsuperuser
```
Follow the interactive prompt to register your admin phone number, name, and password!

### 4. Open PostgreSQL Shell inside Docker
To query database tables directly inside the containerized PostgreSQL database:
```bash
docker compose exec db psql -U postgres -d baraka
```

---

## 🛑 Stopping & Resetting the Application

### To Stop All Containers (Keeping Data Intact)
```bash
docker compose down
```

### To Completely Reset the Application (Deletes Persistent PostgreSQL Volumes)
If you want to completely wipe the database clean and start with a fresh slate:
```bash
docker compose down -v
```

---

## 🔍 Troubleshooting & Verification

### Port Conflicts
If port `8080` or `5432` is already in use by another application on your system, you can easily change the host ports by modifying the `ports:` mapping inside `docker-compose.yml` under `frontend` or `db`:
```yaml
ports:
  - "YOUR_NEW_PORT:80"
```

### CORS and Reverse Proxy Verification
Thanks to the Nginx reverse-proxy setup, your frontend script `api.js` connects to `/api/...` relatively. Nginx forwards the traffic internally to Gunicorn. This means:
*   You will **never** get CORS blockages in your web console.
*   Your API load times are significantly faster because there are no preflight `OPTIONS` requests.
