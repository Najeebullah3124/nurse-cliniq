#!/usr/bin/env bash
# Deploy Nurse ClinIQ to EC2. Requires working SSH with your .pem.
# Usage:
#   chmod +x scripts/deploy-ec2.sh
#   export SSH_USER=ubuntu          # or ec2-user (Amazon Linux)
#   export DEPLOY_HOST=16.16.253.8
#   export SSH_KEY="$PWD/CLinic.pem"
#   ./scripts/deploy-ec2.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_HOST="${DEPLOY_HOST:-16.16.253.8}"
SSH_USER="${SSH_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-$ROOT/CLinic.pem}"
REMOTE_DIR="${REMOTE_DIR:-/home/${SSH_USER}/nurse-cliniq}"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "Missing key: $SSH_KEY"
  exit 1
fi
chmod 400 "$SSH_KEY" 2>/dev/null || true

SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${DEPLOY_HOST}")
RSYNC=(rsync -avz --delete
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new"
  --exclude node_modules
  --exclude .git
  --exclude .env
  --exclude '*.pem'
  --exclude '*.log'
  --exclude .DS_Store)

echo "==> Testing SSH..."
"${SSH[@]}" "echo SSH OK && uname -a"

echo "==> Syncing files to ${DEPLOY_HOST}:${REMOTE_DIR}..."
"${RSYNC[@]}" "$ROOT/" "${SSH_USER}@${DEPLOY_HOST}:${REMOTE_DIR}/"

echo "==> Installing and starting on server..."
"${SSH[@]}" bash -s <<REMOTE
set -euo pipefail
cd "$REMOTE_DIR"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 18+ first, e.g.: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi
npm install --omit=dev
if [[ ! -f data/students.json ]]; then
  npm run seed || true
fi
if [[ ! -f .env ]]; then
  echo "Creating .env from .env.example — add OPENAI_API_KEY and set JWT_SECRET!"
  cp .env.example .env
  echo "JWT_SECRET=\$(openssl rand -hex 32)" >> .env
  echo "PUBLIC_HOST=${DEPLOY_HOST}" >> .env
  echo "HOST=0.0.0.0" >> .env
  echo "PORT=3000" >> .env
fi
# Run under nohup if pm2 not installed
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete nurse-cliniq 2>/dev/null || true
  pm2 start server.js --name nurse-cliniq --cwd "$REMOTE_DIR"
  pm2 save
  echo "Started with PM2: pm2 status"
else
  pkill -f "node.*server.js" 2>/dev/null || true
  nohup node server.js >> "$REMOTE_DIR/app.log" 2>&1 &
  echo "Started with nohup; logs: $REMOTE_DIR/app.log"
fi
echo "Open http://${DEPLOY_HOST}:3000 (ensure security group allows TCP 3000)"
REMOTE

echo "==> Done."
