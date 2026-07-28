#!/usr/bin/env bash
# Executado na VPS pela chave de deploy dedicada (forced command em authorized_keys).
# Faz git pull --ff-only, rebuild, health check e rollback automático se falhar.
set -euo pipefail

# Trava contra execuções sobrepostas.
#
# O workflow tenta a conexão SSH até 3 vezes. Se ela cair DEPOIS que este script
# já começou, o ssh devolve 255 (indistinguível de "não conectou") e a tentativa
# seguinte dispararia um segundo deploy por cima do primeiro — dois
# `docker compose up --build` no mesmo diretório é receita para estado
# inconsistente.
#
# `-n` falha na hora em vez de enfileirar, e saímos com 0: se já há um deploy
# rodando, o segundo não é erro, é redundância.
exec 9>/var/lock/assusa-deploy.lock
flock -n 9 || { echo "deploy: outro deploy já está em andamento — nada a fazer"; exit 0; }

cd /root/segunda-via-wpp-assusa

PREV="$(git rev-parse HEAD)"
echo "deploy: current=$PREV"

git fetch --prune origin
git pull --ff-only origin main
NEW="$(git rev-parse HEAD)"
if [ "$PREV" = "$NEW" ]; then
  echo "deploy: already up to date"
fi

health() {
  for i in $(seq 1 45); do
    curl -fsS --max-time 3 http://127.0.0.1:8080/ >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

docker compose up -d --build

if health; then
  echo "deploy: OK at $NEW"
  docker image prune -f >/dev/null || true
else
  echo "deploy: HEALTH FAILED — rolling back to $PREV" >&2
  docker compose logs --tail=100 web >&2 || true
  git reset --hard "$PREV"
  docker compose up -d --build
  if health; then
    echo "deploy: rolled back to $PREV" >&2
  else
    echo "deploy: rollback ALSO failed health check — manual intervention required" >&2
  fi
  exit 1
fi
