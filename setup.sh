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
#
# The environment defaults to "dev".

set -euo pipefail

cd "$(dirname "$0")"

COMMAND="${1:-}"
ENVIRONMENT="${2:-dev}"
CONTAINER="nestjs-base-project"
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
  sed -n '3,14p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

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

prepare_env() {
  if [ ! -f .env ]; then
    info "Creating .env from .env.example"
    cp .env.example .env
    generate_jwt_keys

    if [ "$ENVIRONMENT" = "prod" ]; then
      set_env APP_ENVIRONMENT production
      set_env SWAGGER false
      set_env LOG_LEVEL log
    fi

    fix_ownership .env
    success ".env created with a new JWT key pair"
  else
    info "Using the existing .env"

    # .env files created before the RS256 keys were introduced
    if [ -z "$(get_env JWT_PRIVATE_KEY)" ]; then
      generate_jwt_keys
      unset_env JWT_KEY
      fix_ownership .env
      success "JWT key pair added to .env (JWT_KEY is no longer used)"
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
  echo "  App:     $base"
  echo "  Health:  $base/health"
  [ "$(get_env SWAGGER)" = "true" ] && echo "  Swagger: $base/doc"
  [ "$ENVIRONMENT" = "dev" ] && echo "  Debug:   localhost:$(get_env DEBUG_PORT | grep . || echo 9229)"
  echo
  echo "  Logs:    $SETUP_CMD logs $ENVIRONMENT"
  echo "  Stop:    $SETUP_CMD stop $ENVIRONMENT"
  echo
}

# Copies the container's node_modules to the project folder, so the editor
# can resolve the dependencies (dev only)
copy_node_modules() {
  info "Copying node_modules from the container to the project folder"
  mkdir -p node_modules
  docker cp "$CONTAINER:/var/www/html/node_modules/." ./node_modules >/dev/null
  fix_ownership node_modules
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
  [ "$ENVIRONMENT" = "dev" ] && copy_node_modules
  print_urls
}

start() {
  check_requirements
  [ -f .env ] || fail ".env not found. Run: $SETUP_CMD install $ENVIRONMENT"

  info "Starting the $ENVIRONMENT environment"
  compose up -d
  wait_until_healthy
  print_urls
}

case "$COMMAND" in
  install) install ;;
  start) start ;;
  stop) compose down ;;
  restart)
    compose restart
    wait_until_healthy
    ;;
  logs) compose logs -f ;;
  status)
    compose ps
    docker exec "$CONTAINER" pm2 status 2>/dev/null || true
    ;;
  *) usage ;;
esac
