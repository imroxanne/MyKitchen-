#!/usr/bin/env bash
# Проверка миграций на обычном Postgres без Docker: создаёт чистую БД,
# накатывает имитацию Supabase, все миграции по порядку и SQL-проверки.
#   PG_ADMIN_URL — подключение с правом создавать БД (по умолчанию локальный postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."

ADMIN_URL="${PG_ADMIN_URL:-postgresql:///postgres}"
DB_NAME="mykitchen_shim_test"
DB_URL="${ADMIN_URL%/*}/${DB_NAME}"

psql "$ADMIN_URL" -X -q -c "drop database if exists ${DB_NAME}" -c "create database ${DB_NAME}"
psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f scripts/db/supabase-shim.sql

for migration in supabase/migrations/*.sql; do
  echo "▶ $migration"
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$migration"
done

DB_URL="$DB_URL" scripts/db/run-tests.sh
