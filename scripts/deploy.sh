#!/usr/bin/env bash
# Publica em produção exatamente o que está commitado.
#
# Uso:
#   npm run deploy
#   SIGEN_DEPLOY_HOST=usuario@servidor npm run deploy
#   SIGEN_DEPLOY_REF=master npm run deploy
#
# O host padrão fica em `.deploy.env` (gitignored) ou em SIGEN_DEPLOY_HOST.
# Só entram arquivos versionados: pastas de estudo, `.env`, `data/` e
# `.auth/` ficam de fora e continuam intactos no servidor.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .deploy.env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.deploy.env
  set +a
fi

HOST="${SIGEN_DEPLOY_HOST:-}"
DEST="${SIGEN_DEPLOY_DIR:-~/controle-sigen}"
REF="${SIGEN_DEPLOY_REF:-HEAD}"

if [ -z "$HOST" ]; then
  echo "Defina SIGEN_DEPLOY_HOST (ou crie .deploy.env) com usuario@servidor." >&2
  exit 1
fi

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
  --exclude '.deploy.env' \
  --exclude '.auth' \
  --exclude 'data' \
  --exclude 'fixtures/private' \
  --exclude '*.pdf' \
  --exclude '*.log' \
  --exclude 'coverage' \
  "$tmp/" "$HOST:$DEST/"

echo "Reconstruindo e reiniciando o container"
ssh "$HOST" "cd $DEST && docker compose up -d --build"

echo "Pronto. Verifique com: ssh $HOST 'curl -s http://127.0.0.1:3000/api/health'"
