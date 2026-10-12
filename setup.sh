#!/usr/bin/env bash
#
# Installs and runs the application with Docker.
#
# Usage: ./setup.sh <command> [dev|prod]
#
#   install   check requirements, create .env, build the image and start the app
#   start     start the app without rebuilding the image
#   stop      stop and remove the container
#   restart   restart the container
#   logs      follow the application logs
#   status    show the container and PM2 status
#   metabase  start Metabase with the statistics dashboard (dev only)
#
# The environment defaults to "dev".
#
# Usage: ./setup.sh backfill [dev|prod]
#
#   backfill  loads the matches not collected yet: public ones of the last
#             PUBLIC_WINDOW_HOURS and pro ones of the current patch; the app
#             must be running
#
# Usage: ./setup.sh rename <new-name>
#
#   rename    renames the project (package, containers, images, JWT issuer...)
#             to start a new project from this base

set -euo pipefail

cd "$(dirname "$0")"

COMMAND="${1:-}"
ENVIRONMENT="${2:-dev}"
CONTAINER="dota-metrics"
HEALTH_TIMEOUT=180

# When running inside the setup container (docker-compose.setup.yml)
if [ -f /.dockerenv ]; then
  SETUP_CMD="docker-compose -f docker-compose.setup.yml run --rm setup"
else
  SETUP_CMD="./setup.sh"
fi

info() { printf '\033[34m==>\033[0m %s\n' "$*"; }
success() { printf '\033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
fail() {
  printf '\033[31m✖\033[0m %s\n' "$*" >&2
  exit 1
}

usage() {
  sed -n '3,25p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

# ---- rename ----

# Replaces the current project name (package.json "name") in every project
# file, so a new project can start from this base
rename_project() {
  local new="$1" current files file tmp mode

  [[ "$new" =~ ^[a-z][a-z0-9-]*[a-z0-9]$ ]] ||
    fail "Invalid name \"$new\": use lowercase letters, numbers and hyphens (e.g. orders-service)"

  current="$(sed -n 's/^  "name": "\(.*\)",$/\1/p' package.json | head -n 1)"
  [ -n "$current" ] || fail "Could not read the current name from package.json"
  [ "$new" != "$current" ] || fail "The project is already named \"$new\""

  if command -v docker >/dev/null 2>&1 &&
    docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$current"; then
    fail "The container \"$current\" is running. Stop it first: $SETUP_CMD stop"
  fi

  info "Renaming \"$current\" to \"$new\""

  # find + grep instead of "grep -r --exclude-dir", which the busybox grep of
  # the setup container does not support
  files="$(find . \( -path ./node_modules -o -path ./.git -o -path ./dist \
    -o -path ./coverage -o -path ./logs \) -prune \
    -o -type f -exec grep -lF -- "$current" {} + || true)"
  [ -n "$files" ] || fail "No file contains the name \"$current\""

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    # writes a new file instead of editing in place: this script is one of them
    mode="$(stat -c '%a' "$file" 2>/dev/null || stat -f '%Lp' "$file")"
    tmp="$(mktemp)"
    sed "s/$current/$new/g" "$file" >"$tmp"
    chmod "$mode" "$tmp"
    mv "$tmp" "$file"
    fix_ownership "$file"
    echo "  ${file#./}"
  done <<<"$files"

  success "Project renamed to \"$new\""
  echo
  echo "  Review the description, the author and the repository URL in"
  echo "  package.json, and the home page (views/index.hbs). Tokens issued with"
  echo "  the old name are no longer valid (JWT_ISSUER and JWT_AUDIENCE changed)."
  echo
}

if [ "$COMMAND" = "rename" ]; then
  [ -n "${2:-}" ] || usage
  # defined below; the rename does not depend on the environment
  RENAME_TO="$2"
  ENVIRONMENT="dev"
fi

case "$ENVIRONMENT" in
  dev) COMPOSE_FILE="docker-compose.dev.yml" ;;
  prod) COMPOSE_FILE="docker-compose.yml" ;;
  *) fail "Unknown environment \"$ENVIRONMENT\" (use dev or prod)" ;;
esac

# ---- requirements ----

check_requirements() {
  info "Checking requirements"

  command -v docker >/dev/null 2>&1 || fail "Docker is not installed: https://docs.docker.com/get-docker/"
  docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker and try again."
  command -v openssl >/dev/null 2>&1 ||
    fail "openssl is not installed. Install it or run the setup in a container (see the README)"

  success "Docker $(docker version --format '{{.Server.Version}}')"
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$COMPOSE_FILE" "$@"
  else
    fail "Docker Compose is not installed: https://docs.docker.com/compose/install/"
  fi
}

# ---- .env ----

# Reads a variable from .env, without quotes
get_env() {
  grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '"' || true
}

# Sets a variable in .env, replacing it when it already exists
set_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  KEY="$key" VALUE="$value" awk '
    BEGIN { done = 0 }
    $0 ~ "^" ENVIRON["KEY"] "=" { print ENVIRON["KEY"] "=\"" ENVIRON["VALUE"] "\""; done = 1; next }
    { print }
    END { if (!done) print ENVIRON["KEY"] "=\"" ENVIRON["VALUE"] "\"" }
  ' .env >"$tmp"
  mv "$tmp" .env
}

# Removes a variable from .env
unset_env() {
  local tmp
  tmp="$(mktemp)"
  grep -vE "^$1=" .env >"$tmp" || true
  mv "$tmp" .env
}

# Generates the RSA key pair that signs (private) and validates (public) the
# tokens, stored base64 encoded in .env
generate_jwt_keys() {
  local dir
  dir="$(mktemp -d)"
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$dir/private.pem" 2>/dev/null
  openssl pkey -in "$dir/private.pem" -pubout -out "$dir/public.pem"
  set_env JWT_PRIVATE_KEY "$(openssl base64 -A -in "$dir/private.pem")"
  set_env JWT_PUBLIC_KEY "$(openssl base64 -A -in "$dir/public.pem")"
  rm -rf "$dir"
}

# Sets the credentials of the postgres container and the DATABASE_URL used by
# the application. Keeps a password that already exists: the database volume
# is initialized with it
configure_database() {
  local user password database
  user="$(get_env POSTGRES_USER)"
  password="$(get_env POSTGRES_PASSWORD)"
  database="$(get_env POSTGRES_DB)"

  user="${user:-dota}"
  database="${database:-dota_metrics}"
  [ -n "$password" ] || password="$(openssl rand -hex 24)"

  set_env POSTGRES_USER "$user"
  set_env POSTGRES_PASSWORD "$password"
  set_env POSTGRES_DB "$database"
  set_env DATABASE_URL "postgresql://$user:$password@postgres:5432/$database"
}

prepare_env() {
  if [ ! -f .env ]; then
    info "Creating .env from .env.example"
    cp .env.example .env
    generate_jwt_keys
    configure_database

    if [ "$ENVIRONMENT" = "prod" ]; then
      set_env APP_ENVIRONMENT production
      set_env SWAGGER false
      set_env LOG_LEVEL log
    fi

    fix_ownership .env
    success ".env created with a new JWT key pair and database password"
  else
    info "Using the existing .env"

    # .env files created before the RS256 keys were introduced
    if [ -z "$(get_env JWT_PRIVATE_KEY)" ]; then
      generate_jwt_keys
      unset_env JWT_KEY
      fix_ownership .env
      success "JWT key pair added to .env (JWT_KEY is no longer used)"
    fi

    # .env files created before the database was introduced
    if [ -z "$(get_env DATABASE_URL)" ]; then
      configure_database
      fix_ownership .env
      success "Database credentials added to .env"
    fi
  fi

  if [ "$ENVIRONMENT" = "prod" ]; then
    local app_environment
    app_environment="$(get_env APP_ENVIRONMENT)"

    [ "$app_environment" = "production" ] ||
      warn "APP_ENVIRONMENT is \"$app_environment\"; set it to \"production\" to disable the demo users"

    [ -n "$(get_env CORS_ORIGINS)" ] ||
      warn "CORS_ORIGINS is empty, so any origin can call the API"
  fi
}

# ---- application ----

port() {
  local value
  value="$(get_env PORT)"
  echo "${value:-3000}"
}

# Checks /health from inside the app container, so it also works when this
# script runs in the setup container (where localhost is not the host)
is_healthy() {
  docker exec "$CONTAINER" node -e "
    fetch('http://localhost:$(port)/health')
      .then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))
  " >/dev/null 2>&1
}

wait_until_healthy() {
  local elapsed=0

  info "Waiting for the application at http://localhost:$(port)/health"
  until is_healthy; do
    if [ "$elapsed" -ge "$HEALTH_TIMEOUT" ]; then
      warn "The application did not respond after ${HEALTH_TIMEOUT}s. Last logs:"
      compose logs --tail 40
      fail "Startup failed"
    fi

    if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
      warn "The container stopped. Last logs:"
      compose logs --tail 40
      fail "Startup failed"
    fi

    sleep 3
    elapsed=$((elapsed + 3))
  done

  success "Application is up"
}

print_urls() {
  local base
  base="http://localhost:$(port)"

  echo
  echo "  Site:    http://localhost:$(get_env WEB_PORT | grep . || echo 3002)"
  echo "  App:     $base"
  echo "  Health:  $base/health"
  [ "$(get_env SWAGGER)" = "true" ] && echo "  Swagger: $base/doc"
  [ "$ENVIRONMENT" = "dev" ] && echo "  Debug:   localhost:$(get_env DEBUG_PORT | grep . || echo 9229)"
  [ "$ENVIRONMENT" = "dev" ] && echo "  Postgres: localhost:$(get_env POSTGRES_PORT | grep . || echo 5432)"
  echo
  echo "  Logs:    $SETUP_CMD logs $ENVIRONMENT"
  echo "  Stop:    $SETUP_CMD stop $ENVIRONMENT"
  echo
}

# Applies the pending migrations (dev only: the production container applies
# them when it starts, see docker/Dockerfile)
run_migrations() {
  info "Applying database migrations"
  docker exec "$CONTAINER" npx prisma migrate deploy >/dev/null
  success "Database is up to date"
}

# Copies the container's node_modules to the project folder, so the editor
# can resolve the dependencies (dev only)
copy_node_modules() {
  info "Copying node_modules from the container to the project folder"
  mkdir -p node_modules
  docker cp "$CONTAINER:/var/www/html/node_modules/." ./node_modules >/dev/null
  mkdir -p web/node_modules
  docker cp "$CONTAINER-web:/app/node_modules/." ./web/node_modules >/dev/null
  fix_ownership node_modules web/node_modules
  success "node_modules copied"
}

# The setup container runs as root: give the files it creates back to the
# owner of the project folder (matters on Linux hosts)
fix_ownership() {
  if [ -f /.dockerenv ] && [ "$(id -u)" = "0" ]; then
    chown -R "$(stat -c '%u:%g' .)" "$@" 2>/dev/null || true
  fi
}

install() {
  check_requirements
  prepare_env

  info "Building and starting the $ENVIRONMENT environment"
  # -V recreates the node_modules volume so new dependencies are picked up
  compose up -d --build --remove-orphans -V

  wait_until_healthy
  if [ "$ENVIRONMENT" = "dev" ]; then
    run_migrations
    copy_node_modules
  fi
  print_urls
}

start() {
  check_requirements
  [ -f .env ] || fail ".env not found. Run: $SETUP_CMD install $ENVIRONMENT"

  info "Starting the $ENVIRONMENT environment"
  compose up -d
  wait_until_healthy
  [ "$ENVIRONMENT" = "dev" ] && run_migrations
  print_urls
}

# ---- metabase (development) ----

# Credentials of the Metabase admin and of its read-only database user
configure_metabase() {
  [ -n "$(get_env METABASE_ADMIN_EMAIL)" ] ||
    set_env METABASE_ADMIN_EMAIL "admin@dota-metrics.local"
  [ -n "$(get_env METABASE_ADMIN_PASSWORD)" ] ||
    set_env METABASE_ADMIN_PASSWORD "$(openssl rand -hex 16)"
  [ -n "$(get_env METABASE_READER_PASSWORD)" ] ||
    set_env METABASE_READER_PASSWORD "$(openssl rand -hex 24)"
  fix_ownership .env
}

# Creates the "metabase" database (Metabase's own data) and the read-only
# user that Metabase uses to query the application tables, including the
# tables created by future migrations
prepare_metabase_database() {
  docker exec -i "$CONTAINER-postgres" sh -c \
    'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v reader_password="$1"' \
    sh "$(get_env METABASE_READER_PASSWORD)" <<'SQL'
SELECT 'CREATE DATABASE metabase'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'metabase') \gexec
SELECT 'CREATE ROLE metabase_reader LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'metabase_reader') \gexec
ALTER ROLE metabase_reader PASSWORD :'reader_password';
GRANT USAGE ON SCHEMA public TO metabase_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metabase_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO metabase_reader;
SQL
}

metabase() {
  [ "$ENVIRONMENT" = "dev" ] || fail "Metabase is only available in development"
  check_requirements
  [ -f .env ] || fail ".env not found. Run: $SETUP_CMD install dev"
  docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" ||
    fail "The application is not running. Run: $SETUP_CMD start dev"

  configure_metabase
  info "Preparing the database for Metabase"
  prepare_metabase_database

  info "Starting Metabase (the first start takes about a minute)"
  compose --profile metabase up -d metabase

  info "Configuring Metabase"
  docker exec \
    -e METABASE_ADMIN_EMAIL="$(get_env METABASE_ADMIN_EMAIL)" \
    -e METABASE_ADMIN_PASSWORD="$(get_env METABASE_ADMIN_PASSWORD)" \
    -e METABASE_READER_PASSWORD="$(get_env METABASE_READER_PASSWORD)" \
    -e POSTGRES_DB="$(get_env POSTGRES_DB)" \
    "$CONTAINER" node docker/metabase-setup.mjs
  success "Metabase is up"

  echo
  echo "  Metabase: http://localhost:$(get_env METABASE_PORT | grep . || echo 3001)"
  echo "  Login:    $(get_env METABASE_ADMIN_EMAIL)"
  echo "  Password: METABASE_ADMIN_PASSWORD in .env"
  echo
}

# ---- backfill ----

# Loads past matches in the running app container (src/backfill.ts); the
# worker then fetches their details within the daily quota
backfill() {
  docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" ||
    fail "The application is not running. Run: $SETUP_CMD start $ENVIRONMENT"

  info "Loading past matches (it can take a few minutes)"
  docker exec "$CONTAINER" node dist/backfill.js
}

case "$COMMAND" in
  rename) rename_project "$RENAME_TO" ;;
  install) install ;;
  start) start ;;
  # the profile also stops Metabase when it is running
  stop) compose --profile metabase down ;;
  restart)
    compose restart
    wait_until_healthy
    ;;
  logs) compose logs -f ;;
  status)
    compose ps
    docker exec "$CONTAINER" pm2 status 2>/dev/null || true
    ;;
  metabase) metabase ;;
  backfill) backfill ;;
  *) usage ;;
esac
