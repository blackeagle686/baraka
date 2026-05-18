# ⚡ Baraka Vercel Deployment Guide

This guide walks you through deploying the **Baraka Static Frontend** to **Vercel** with fully automated local-vs-production environment detection and reverse-proxying configuration.

---

## 🌟 Instant Vercel Setup

You can deploy Baraka to Vercel in just three simple steps:

### 1. Push to GitHub
Ensure all your local changes (including the new `vercel.json` configurations) are committed and pushed to your GitHub/GitLab repository.

### 2. Import to Vercel
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New"** ➔ **"Project"**.
2. Select your `baraka` repository.

### 3. Deploy (Zero Config!)
* **Option A: Deploy the Entire Repository** (Recommended & simplest):
  Leave the "Root Directory" as the repository root `/`. The root [vercel.json](./vercel.json) will automatically route all static pages to the `/frontend` directory and forward `/api` requests without CORS issues.
* **Option B: Deploy only the Frontend Directory**:
  Under "Build & Development Settings", set the **"Root Directory"** to `frontend`. The frontend-specific [vercel.json](./frontend/vercel.json) will handle the static assets and API routing.

---

## 🔗 Connecting the Production Backend API

By default, in **local development**, the frontend automatically detects your local python server and routes all database/API calls to `http://127.0.0.1:8000/api`.

In **production (Vercel)**, all calls go to `/api/...` relatively. Vercel acts as a reverse proxy, forwarding requests to your hosted backend (e.g. Render, Railway, or a VPS).

### How to Update the Production API Destination:
To connect the Vercel site to your actual production Django server, open [vercel.json](./vercel.json) (and [frontend/vercel.json](./frontend/vercel.json)) and replace the placeholder domain with your actual backend URL:

```json
"rewrites": [
  {
    "source": "/api/:path*",
    "destination": "https://YOUR-PRODUCTION-DJANGO-API.com/api/:path*"
  }
]
```

---

## 🏆 Production Benefits of this Setup
* **No CORS Issues**: Because Vercel proxies your API requests through the same domain as the frontend, the browser never triggers CORS blocks, and there are no slow preflight `OPTIONS` requests!
* **Dynamic Local/Prod Detection**: You don't have to change a single line of code in [api.js](./frontend/js/api.js) when transitioning between local coding and live cloud deployments.
