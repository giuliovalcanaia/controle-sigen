#!/usr/bin/env bash
# Publica em produção exatamente o que está commitado.
#
# Uso:
#   npm run deploy
#   SIGEN_DEPLOY_REF=master npm run deploy
#   SIGEN_DEPLOY_HOST=giulio@100.117.79.72 npm run deploy
#
# Só entram arquivos versionados: pastas de estudo, `.env`, `data/` e
# `.auth/` ficam de fora e continuam intactos no servidor.
set -euo pipefail

HOST="${SIGEN_DEPLOY_HOST:-giulio@100.117.79.72}"
DEST="${SIGEN_DEPLOY_DIR:-~/controle-sigen}"
REF="${SIGEN_DEPLOY_REF:-HEAD}"

cd "$(dirname "$0")/.."

branch="$(git rev-parse --abbrev-ref "$REF")"
commit="$(git rev-parse --short "$REF")"

if [ "$branch" != "master" ]; then
  echo "Atenção: publicando '$branch' ($commit), não 'master'." >&2
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Atenção: há alterações não commitadas; elas não serão enviadas." >&2
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git archive --format=tar "$REF" | tar -xf - -C "$tmp"

echo "Enviando $branch ($commit) para $HOST:$DEST"
rsync -a --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '.auth' \
  --exclude 'data' \
  --exclude 'fixtures/private' \
  --exclude '*.pdf' \
  --exclude '*.log' \
  --exclude 'coverage' \
  "$tmp/" "$HOST:$DEST/"

echo "Reconstruindo e reiniciando o container"
ssh "$HOST" "cd $DEST && docker compose up -d --build"

echo "Pronto. Verifique com: curl -s https://desktop-home.tailb33a32.ts.net/api/health"
