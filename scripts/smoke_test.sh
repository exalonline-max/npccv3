#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .venv/bin/activate
EMAIL="smoke+$(date +%s)@example.com"
JSON_PAYLOAD=$(printf '{"email":"%s","username":"smoke","password":"testpass"}' "$EMAIL")
REG=$(curl -sS -X POST http://127.0.0.1:5000/api/auth/register -H 'Content-Type: application/json' -d "$JSON_PAYLOAD")
echo "REGISTER: $REG"
TOK=$(echo "$REG" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
if [ -z "$TOK" ]; then
  echo "ERROR: no token returned on register"
  exit 2
fi
LOGIN=$(curl -sS -X POST http://127.0.0.1:5000/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"testpass\"}")
echo "LOGIN: $LOGIN"
TOK2=$(echo "$LOGIN" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))')
if [ -z "$TOK2" ]; then
  echo "ERROR: no token returned on login"
  exit 3
fi
echo "GET before character (should be empty/404):"
curl -sS -X GET http://127.0.0.1:5000/api/users/me/character -H "Authorization: Bearer $TOK2" -w '\nHTTP:%{http_code}\n'

echo "PUT create character"
curl -sS -X PUT http://127.0.0.1:5000/api/users/me/character -H "Authorization: Bearer $TOK2" -H 'Content-Type: application/json' -d '{"name":"SmokeTest","maxHp":5,"portrait":"","attributes":{"test":1},"skills":{},"skillScores":{},"inventory":[],"campaign_id":1}' -w '\nHTTP:%{http_code}\n'

echo "GET after character (expect 200):"
curl -sS -X GET http://127.0.0.1:5000/api/users/me/character -H "Authorization: Bearer $TOK2" -w '\nHTTP:%{http_code}\n'
