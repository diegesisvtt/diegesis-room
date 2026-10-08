#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Diegesis Room — instalador de servidor (um único comando)
#
# Baixa o release mais recente (ou uma versão específica) e configura o
# serviço para rodar via Docker OU Bun puro (systemd).
#
# Instalação interativa (recomendado):
#   curl -fsSL https://github.com/diegesisvtt/diegesis-room/releases/latest/download/install.sh -o install.sh
#   bash install.sh
#
# Instalação não-interativa (via variáveis de ambiente):
#   curl -fsSL https://github.com/diegesisvtt/diegesis-room/releases/latest/download/install.sh | \
#     env MODE=systemd LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... \
#         PUBLIC_URL=https://meu.servidor bash
#
# Opções (flags ou variáveis de ambiente):
#   --mode docker|systemd   (MODE)        Como rodar o serviço. Padrão: docker
#   --version v1.2.3        (VERSION)     Tag específica. Padrão: latest
#   --dir /opt/diegesis-room (INSTALL_DIR) Diretório de instalação
#   --port 3000             (PORT)        Porta HTTP
#   --non-interactive       (NO_PROMPT=1) Usa variáveis de ambiente, sem perguntar
# ============================================================================

REPO="diegesisvtt/diegesis-room"
APP="diegesis-room"

MODE="${MODE:-docker}"
VERSION="${VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/opt/$APP}"
PORT="${PORT:-3000}"
NO_PROMPT="${NO_PROMPT:-0}"

usage() {
  cat <<'EOF'
Uso:
  curl -fsSL https://github.com/diegesisvtt/diegesis-room/releases/latest/download/install.sh -o install.sh
  bash install.sh

Opções (flags ou variáveis de ambiente):
  --mode docker|systemd   (MODE)        Como rodar o serviço. Padrão: docker
  --version v1.2.3        (VERSION)     Tag específica. Padrão: latest
  --dir /opt/diegesis-room (INSTALL_DIR) Diretório de instalação
  --port 3000             (PORT)        Porta HTTP
  --non-interactive       (NO_PROMPT=1) Usa variáveis de ambiente, sem perguntar
EOF
}

log()  { printf '\033[1;34m[diegesis-room]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[diegesis-room]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[diegesis-room]\033[0m %s\n' "$*" >&2; exit 1; }

# ---- args ----------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --mode)             MODE="$2"; shift 2 ;;
    --version)          VERSION="$2"; shift 2 ;;
    --dir)              INSTALL_DIR="$2"; shift 2 ;;
    --port)             PORT="$2"; shift 2 ;;
    --non-interactive)  NO_PROMPT=1; shift ;;
    -h|--help)          usage; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

if [ "$MODE" != "docker" ] && [ "$MODE" != "systemd" ]; then
  die "MODE inválido: '$MODE' (use 'docker' ou 'systemd')"
fi

# ---- helpers -------------------------------------------------------------
need() { command -v "$1" >/dev/null 2>&1 || die "Comando '$1' não encontrado. Instale antes de continuar."; }

require_root() {
  [ "$(id -u)" -eq 0 ] || die "Execute como root (use sudo)."
}

prompt() {
  local text="$1" default="$2" value
  if [ "$NO_PROMPT" = "1" ]; then
    value="$default"
  else
    printf '%s' "$text [${default}]: "
    read -r value
    value="${value:-$default}"
  fi
  printf '%s' "$value"
}

# ---- dependências --------------------------------------------------------
need curl
need tar

if [ "$MODE" = "docker" ]; then
  need docker
  docker info >/dev/null 2>&1 || die "Docker não está acessível. O daemon está rodando?"
else
  require_root
  command -v systemctl >/dev/null 2>&1 || die "Modo systemd exige systemd (systemctl não encontrado)."
fi

# ---- obter o release -----------------------------------------------------
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

# Rodando a partir de um release extraído (install.sh junto de dist/)?
if [ -f "dist-server/index.js" ] && [ -d "dist" ] && [ -d "drizzle" ]; then
  log "Release local detectado no diretório atual — usando arquivos locais."
  SRC_DIR="$(pwd)"
else
  if [ "$VERSION" = "latest" ]; then
    URL="https://github.com/${REPO}/releases/latest/download/${APP}.tar.gz"
  else
    VER="${VERSION#v}"
    TAG="$VERSION"
    case "$TAG" in v*) ;; *) TAG="v$TAG" ;; esac
    URL="https://github.com/${REPO}/releases/download/${TAG}/${APP}-${VER}.tar.gz"
  fi
  log "Baixando ${URL}"
  curl -fsSL "$URL" -o "$STAGING/pkg.tar.gz" || die "Falha ao baixar o release. A tag/asset existe?"
  mkdir -p "$STAGING/extract"
  tar -xzf "$STAGING/pkg.tar.gz" -C "$STAGING/extract" || die "Falha ao extrair o pacote."
  SRC_DIR="$STAGING/extract"
fi

# ---- instalar arquivos ---------------------------------------------------
require_root
mkdir -p "$INSTALL_DIR"

# Preserva .env e data/ em upgrades.
if [ -f "$INSTALL_DIR/.env" ]; then
  cp "$INSTALL_DIR/.env" "$STAGING/.env.backup"
fi

log "Instalando em $INSTALL_DIR"
# Remove versões anteriores para evitar cópia aninhada (dist/dist) no upgrade.
rm -rf "$INSTALL_DIR/dist" "$INSTALL_DIR/dist-server" "$INSTALL_DIR/drizzle"
cp -r "$SRC_DIR/dist" "$SRC_DIR/dist-server" "$SRC_DIR/drizzle" "$INSTALL_DIR/"
[ -f "$SRC_DIR/Dockerfile" ]         && cp "$SRC_DIR/Dockerfile"         "$INSTALL_DIR/Dockerfile"
[ -f "$SRC_DIR/docker-compose.yml" ] && cp "$SRC_DIR/docker-compose.yml" "$INSTALL_DIR/docker-compose.yml"
[ -f "$SRC_DIR/.env.example" ]       && cp "$SRC_DIR/.env.example"       "$INSTALL_DIR/.env.example"

if [ -f "$STAGING/.env.backup" ]; then
  cp "$STAGING/.env.backup" "$INSTALL_DIR/.env"
  log "Preservado .env existente."
fi

mkdir -p "$INSTALL_DIR/data"

# ---- .env ----------------------------------------------------------------
if [ ! -f "$INSTALL_DIR/.env" ]; then
  log "Configurando .env"
  PUBLIC_URL_DEFAULT="${PUBLIC_URL:-http://localhost:${PORT}}"
  if [ "$NO_PROMPT" = "1" ]; then
    LIVEKIT_URL_VAL="${LIVEKIT_URL:-}"
    LIVEKIT_API_KEY_VAL="${LIVEKIT_API_KEY:-}"
    LIVEKIT_API_SECRET_VAL="${LIVEKIT_API_SECRET:-}"
    PUBLIC_URL_VAL="$PUBLIC_URL_DEFAULT"
  else
    LIVEKIT_URL_VAL=$(prompt "LiveKit URL (vazio = modo demo)" "${LIVEKIT_URL:-}")
    LIVEKIT_API_KEY_VAL=$(prompt "LiveKit API Key" "${LIVEKIT_API_KEY:-}")
    LIVEKIT_API_SECRET_VAL=$(prompt "LiveKit API Secret" "${LIVEKIT_API_SECRET:-}")
    PUBLIC_URL_VAL=$(prompt "URL pública do app" "$PUBLIC_URL_DEFAULT")
  fi

  cat > "$INSTALL_DIR/.env" <<EOF
# Server
PORT=${PORT}
DATABASE_URL=./data/diegesis.db

# LiveKit (vazio = modo demo; também configurável pela UI)
LIVEKIT_URL=${LIVEKIT_URL_VAL}
LIVEKIT_API_KEY=${LIVEKIT_API_KEY_VAL}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET_VAL}

# Origem pública usada nos links de convite
PUBLIC_URL=${PUBLIC_URL_VAL}
EOF
  chmod 600 "$INSTALL_DIR/.env"
fi

# ---- instalar o serviço --------------------------------------------------
if [ "$MODE" = "docker" ]; then
  IMAGE="$APP:${VERSION#v}"
  log "Buildando imagem Docker ${IMAGE}"
  docker build -t "$IMAGE" "$INSTALL_DIR" || die "Falha ao buildar a imagem Docker."

  docker rm -f "$APP" >/dev/null 2>&1 || true
  log "Iniciando container ${APP}"
  docker run -d \
    --name "$APP" \
    --restart unless-stopped \
    -p "${PORT}:3000" \
    -v "${APP}-data:/app/data" \
    --env-file "$INSTALL_DIR/.env" \
    -e PORT=3000 \
    "$IMAGE" >/dev/null || die "Falha ao iniciar o container."
  log "Container '${APP}' rodando na porta ${PORT}."
else
  # Instala o Bun system-wide se necessário.
  if ! command -v bun >/dev/null 2>&1; then
    log "Instalando Bun (system-wide)"
    curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash || die "Falha ao instalar Bun."
    export PATH="/usr/local/bin:$PATH"
  fi
  BUN_BIN="$(command -v bun)"
  log "Bun: $BUN_BIN"

  if ! id -u "$APP" >/dev/null 2>&1; then
    useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin "$APP"
  fi
  chown -R "$APP:$APP" "$INSTALL_DIR"

  cat > "/etc/systemd/system/${APP}.service" <<EOF
[Unit]
Description=Diegesis Room
After=network.target

[Service]
Type=simple
User=${APP}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=${BUN_BIN} dist-server/index.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$APP"
  systemctl restart "$APP" || systemctl start "$APP"
  log "Serviço systemd '${APP}' iniciado."
fi

# ---- health check --------------------------------------------------------
log "Aguardando subir e checando /api/health..."
HEALTHY=0
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  sleep 1
done

if [ "$HEALTHY" = "1" ]; then
  log "OK — app respondendo em http://localhost:${PORT}"
else
  warn "Não consegui confirmar o health check ainda (o app pode estar iniciando)."
fi

cat <<EOF

Pronto! Acesse: http://localhost:${PORT}

Arquivos instalados em: ${INSTALL_DIR}
Dados (SQLite):         ${INSTALL_DIR}/data/
Config (env):           ${INSTALL_DIR}/.env

Para atualizar, rode o mesmo comando novamente (preserva dados e .env).
EOF

if [ "$MODE" = "docker" ]; then
  echo "Dica: prefere Docker Compose? Um docker-compose.yml foi instalado em ${INSTALL_DIR}."
  echo "      Use: cd ${INSTALL_DIR} && docker compose up -d --build"
fi
