#!/usr/bin/env bash
#
# Run this ON THE SERVER (after deploy.sh has synced the code, and after
# you've copied your local .env to /tmp/api.env). It wires up everything
# that's missing on a fresh box: the env file, the systemd API service, and
# the nginx fix.
#
#   scp .env erp@<server>:/tmp/api.env      # from your laptop, first
#   ssh erp@<server>
#   cd /var/www/zentallio
#   sudo bash deploy/server-setup.sh

set -euo pipefail

ROOT="/var/www/zentallio"

echo "== 1/5  env file =="
sudo mkdir -p /etc/zentallio
if [[ -f /tmp/api.env ]]; then
  sudo mv /tmp/api.env /etc/zentallio/api.env
  sudo chown root:www-data /etc/zentallio/api.env
  sudo chmod 640 /etc/zentallio/api.env
  echo "   installed /etc/zentallio/api.env"
else
  echo "   /tmp/api.env not found -- skipping (run: scp .env erp@server:/tmp/api.env from your laptop first, then re-run this)"
fi

echo "== 2/5  node path check =="
NODE_PATH="$(which node || true)"
echo "   which node -> ${NODE_PATH:-NOT FOUND}"
if [[ "$NODE_PATH" != "/usr/bin/node" ]]; then
  echo "   !! zentallio-api.service assumes /usr/bin/node -- edit ExecStart in"
  echo "      $ROOT/deploy/zentallio-api.service to use '$NODE_PATH' before continuing,"
  echo "      then re-run this script."
fi

echo "== 3/5  systemd service =="
sudo cp "$ROOT/deploy/zentallio-api.service" /etc/systemd/system/zentallio-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now zentallio-api
sleep 1
sudo systemctl is-active zentallio-api
curl -fsS http://127.0.0.1:3001/health && echo

echo "== 4/5  nginx =="
sudo cp "$ROOT/deploy/zentallio-nginx-live.conf" /etc/nginx/sites-enabled/zentallio
sudo nginx -t
sudo systemctl reload nginx

echo "== 5/5  verify =="
for p in / /about /contact /resources /fashion/sector-solutions; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://zentallio.com$p" || echo "ERR")
  printf "   %-30s %s\n" "$p" "$code"
done

echo
echo "✓ done — open https://zentallio.com/contact in a browser to confirm."
