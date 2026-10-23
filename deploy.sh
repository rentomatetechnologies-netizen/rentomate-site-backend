#!/bin/sh
# Deploy the latest master on the VPS: pull, rebuild the image, restart, and wait until the API is healthy.
# Usage (on the VPS): sh /var/www/rentomate-backend/deploy.sh
set -e
cd "$(dirname "$0")"

echo "==> Pulling latest code"
git pull --ff-only origin master

echo "==> Building and restarting (migrations run on start)"
docker compose up -d --build

echo "==> Waiting for the API to become healthy"
container=$(docker compose ps -q backend)
for i in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' "$container")
  if [ "$status" = "healthy" ]; then
    docker compose logs --tail 20 backend
    docker image prune -f >/dev/null
    echo "==> Backend is live"
    exit 0
  fi
  sleep 2
done

echo "==> Backend did not become healthy in 60s. Recent logs:"
docker compose logs --tail 80 backend
exit 1
