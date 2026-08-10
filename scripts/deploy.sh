#!/usr/bin/env bash
set -e

COMMIT_MSG="${1:-update: deploy automatico sincronizado}"

echo "=========================================="
echo "🚀 1. Compilando TypeScript local..."
echo "=========================================="
npm run build

echo "=========================================="
echo "📦 2. Enviando para o GitHub..."
echo "=========================================="
git add .
git commit -m "$COMMIT_MSG" || true
git push origin main

echo "=========================================="
echo "🖥️ 3. Sincronizando com o Positivo via SSH..."
echo "=========================================="
# Identifica host disponível (Tailscale 100.69.148.54 ou IP local 192.168.101.11)
POSITIVO_HOST="100.69.148.54"
if ! ping -c 1 -W 2 "$POSITIVO_HOST" > /dev/null 2>&1; then
  POSITIVO_HOST="192.168.101.11"
fi

echo "Conectando em $POSITIVO_HOST..."
ssh emersonmeraki@"$POSITIVO_HOST" "cd ~/url_normalizer && git pull origin main && npm run build && pm2 restart url_normalizer && pm2 save"

echo "=========================================="
echo "🎉 DEPLOY CONCLUÍDO COM SUCESSO NO POSITIVO!"
echo "=========================================="
