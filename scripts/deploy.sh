#!/usr/bin/env bash
# Publica o código no servidor de produção e reconstrói o container.
#
# Uso:
#   npm run deploy
#   SIGEN_DEPLOY_HOST=giulio@100.117.79.72 npm run deploy
#
# O .env, o data/ (apelidos) e a sessão salva ficam apenas no servidor e
# nunca são sobrescritos por este script.
set -euo pipefail

HOST="${SIGEN_DEPLOY_HOST:-giulio@100.117.79.72}"
DEST="${SIGEN_DEPLOY_DIR:-~/controle-sigen}"

cd "$(dirname "$0")/.."

echo "Enviando código para $HOST:$DEST"
rsync -a --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'dev-dist' \
  --exclude 'data' \
  --exclude '.auth' \
  --exclude '.env' \
  --exclude 'fixtures/private' \
  --exclude '*.pdf' \
  --exclude '*.log' \
  --exclude 'coverage' \
  ./ "$HOST:$DEST/"

echo "Reconstruindo e reiniciando o container"
ssh "$HOST" "cd $DEST && docker compose up -d --build"

echo "Pronto. Verifique com: curl -s https://desktop-home.tailb33a32.ts.net/api/health"
