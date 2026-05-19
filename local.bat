@echo off
echo ===================================================
echo   📦 Baraka SaaS Platform Local Workspace Launcher
echo ===================================================
echo.

REM 1. Start Redis Server
echo [1/4] Starting Redis Cache Server...
start "Baraka Redis" cmd /k "echo Starting Redis... && redis-server"

REM 2. Start PostgreSQL Database
echo [2/4] Starting PostgreSQL Database Service...
start "Baraka PostgreSQL" cmd /k "echo Assuring PostgreSQL Service... && net start postgresql-x64-18"

REM 3. Start Django Backend Server
echo [3/4] Starting Django API Backend Server...
start "Baraka Django Backend" cmd /k "echo Activating virtual env and starting Django... && venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000"

REM 4. Start Celery Background Worker
echo [4/4] Starting Celery Background Workers...
start "Baraka Celery Worker" cmd /k "echo Activating virtual env and starting Celery... && venv\Scripts\celery.exe -A backend worker --loglevel=info"

REM 5. Start Python Lightweight Frontend Static Server
echo [5/4] Starting Frontend Static Server on http://localhost:8080...
start "Baraka Frontend Static Server" cmd /k "echo Starting HTTP Server... && python -m http.server 8080 --directory frontend"

echo.
echo ===================================================
echo   🚀 All local services launched in distinct windows!
echo ===================================================
echo.
pause
