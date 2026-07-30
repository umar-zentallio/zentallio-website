#!/usr/bin/env bash
#
# Verify the Cal.com integration from a machine with open network access
# (this repo's build environment blocks outbound calls to api.cal.com, so run
# this on your server or laptop).
#
# The API key is read from the environment — it is never stored in this file.
#
#   export CALCOM_API_KEY='cal_live_...'      # the key you generated in Cal.com
#   ./deploy/calcom-check.sh
#
# It (1) checks the key authenticates and (2) lists your event types with their
# numeric ids — copy the id you want into CALCOM_EVENT_TYPE_ID.
#
set -euo pipefail

: "${CALCOM_API_KEY:?Set CALCOM_API_KEY first:  export CALCOM_API_KEY='cal_live_...'}"

BASE="https://api.cal.com/v2"
AUTH="Authorization: Bearer ${CALCOM_API_KEY}"

echo "== 1. Auth check (GET /v2/me) =="
curl -sS -w '\nHTTP %{http_code}\n' "${BASE}/me" -H "$AUTH"

echo
echo "== 2. Your event types (GET /v2/event-types) =="
echo "   Look for the numeric \"id\" of your walkthrough / call event type."
curl -sS -w '\nHTTP %{http_code}\n' "${BASE}/event-types" \
  -H "$AUTH" -H "cal-api-version: 2024-06-14"

echo
echo "Next: set CALCOM_EVENT_TYPE_ID (and optionally CALCOM_EVENT_ID_CALL) to the"
echo "id(s) above, in /etc/zentallio/api.env, then restart: systemctl restart zentallio-api"
