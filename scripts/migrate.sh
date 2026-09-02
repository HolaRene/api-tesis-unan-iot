#!/usr/bin/env bash
#
# Aplica las migraciones SQL de src/database/migrations a la base de datos
# indicada en DATABASE_URL. Usa psql directamente (sin ORM).
#
# Uso: pnpm migrate

set -euo pipefail

# Cargar variables de entorno desde el archivo adecuado.
# Orden de preferencia:
#   1. .env.<NODE_ENV>   (por ejemplo .env.development)
#   2. .env              (archivo base)
#   3. .env.development  (fallback para desarrollo)
# Utilizamos 'source' respetando el formato KEY=VALUE de dotenv.
cargar_env() {
  if [ -f "$1" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$1"
    set +a
  fi
}

ENTORNO="${NODE_ENV:-}"
if [ -n "$ENTORNO" ]; then
  cargar_env ".env.$ENTORNO"
fi
cargar_env ".env"

if [ -z "${DATABASE_URL:-}" ] &&
   [ "${NODE_ENV:-}" != "production" ] &&
   [ -f ".env.development" ]; then
  cargar_env ".env.development"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: no se encontró DATABASE_URL. Configúrelo en .env o .env.development" >&2
  exit 1
fi

DIRECTORY="src/database/migrations"

if [ ! -d "$DIRECTORY" ]; then
  echo "Error: no existe el directorio $DIRECTORY" >&2
  exit 1
fi

echo "Aplicando migraciones desde $DIRECTORY ..."

for archivo in "$DIRECTORY"/*.sql; do
  # Saltar archivos que no sean .sql (por ejemplo .gitkeep)
  [ -e "$archivo" ] || continue

  echo "-> Aplicando: $(basename "$archivo")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$archivo"
done

echo "Migraciones aplicadas correctamente."
