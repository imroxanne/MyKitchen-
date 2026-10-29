#!/usr/bin/env bash
# Запускает SQL-проверки supabase/tests/*.sql против БД с уже применёнными миграциями.
# По умолчанию — локальный Supabase (`npm run db:start`); адрес можно задать в DB_URL.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

for test in supabase/tests/*.sql; do
  echo "▶ $test"
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$test"
done
echo "✓ SQL-проверки пройдены"
