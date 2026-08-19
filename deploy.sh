#!/usr/bin/env bash
set -e

echo "=== SafeRoute Automated Deployment Script ==="

# 1. Ensure VAPID keys exist
if [ ! -f backend/.env ]; then
  echo "Generating backend .env and VAPID keys..."
  cp .env.example backend/.env
  VAPID_JSON=$(npx web-push generate-vapid-keys --json)
  PUB_KEY=$(echo "$VAPID_JSON" | grep -o '"publicKey": "[^"]*' | grep -o '[^"]*$')
  PRIV_KEY=$(echo "$VAPID_JSON" | grep -o '"privateKey": "[^"]*' | grep -o '[^"]*$')
  
  sed -i.bak "s/VAPID_PUBLIC_KEY=/VAPID_PUBLIC_KEY=$PUB_KEY/" backend/.env
  sed -i.bak "s/VAPID_PRIVATE_KEY=/VAPID_PRIVATE_KEY=$PRIV_KEY/" backend/.env
  rm -f backend/.env.bak
  echo "✓ VAPID keys configured in backend/.env"
fi

# 2. Build Frontend & Backend
echo "Building Frontend & Backend..."
npm run build -w backend
npm run build -w frontend
echo "✓ Builds completed successfully"

# 3. Deploy to Vercel (Frontend) & Render/Railway
echo ""
echo "=== Deployment Commands ==="
echo "To deploy the frontend to Vercel:"
echo "  cd frontend && npx vercel --prod --yes"
echo ""
echo "To deploy the backend to Render / Railway:"
echo "  Push repo to GitHub and link to Render / Railway dashboard using render.yaml"
echo "============================================="
