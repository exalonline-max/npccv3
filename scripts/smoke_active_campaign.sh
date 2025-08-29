#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .venv/bin/activate
EMAIL="ac-smoke+$(date +%s)@example.com"
REG=$(curl -sS -X POST http://127.0.0.1:5000/api/auth/register -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"username\":\"ac_smoke\",\"password\":\"testpass\"}")
printf "REGISTER: %s\n" "$REG"
TOK=$(echo "$REG" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
if [ -z "$TOK" ]; then echo "ERROR: no token"; exit 1; fi
CRE=$(curl -sS -X POST http://127.0.0.1:5000/api/campaigns -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d '{"name":"AC Smoke Campaign"}')
printf "CREATE CAMPAIGN: %s\n" "$CRE"
CID=$(echo "$CRE" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))')
if [ -z "$CID" ]; then echo "ERROR: create campaign failed"; exit 2; fi
RES=$(curl -sS -X PUT http://127.0.0.1:5000/api/users/me/active-campaign -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -d "{\"campaign\":$CID}")
printf "SET ACTIVE: %s\n" "$RES"
TOK2=$(echo "$RES" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
python3 - <<PY
import jwt,sys
try:
    print('DECODE:', jwt.decode('$TOK2', 'devsecret', algorithms=['HS256']))
except Exception as e:
    print('DECODE ERROR', e)
    sys.exit(1)
PY
