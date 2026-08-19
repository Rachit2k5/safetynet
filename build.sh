#!/usr/bin/env bash
set -e

echo "=== SafeRoute Render Build ==="

# 1. Build frontend
echo "[1/3] Building frontend..."
cd frontend
npm install
npm run build
cd ..

# 2. Copy frontend dist to backend
echo "[2/3] Copying frontend build to backend..."
rm -rf backend_fastapi/static_frontend
cp -r frontend/dist backend_fastapi/static_frontend

# 3. Install Python dependencies
echo "[3/3] Installing Python dependencies..."
pip install -r requirements.txt

echo "=== Build complete ==="
