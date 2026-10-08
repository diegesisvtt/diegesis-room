#!/bin/sh
set -eu

# ============================================================================
# Diegesis Room — instalador de servidor (um único comando)
#
# Baixa o release mais recente (ou uma versão específica) e configura o
# serviço para rodar via Docker OU Bun puro (systemd no Linux padrão,
# OpenRC no Alpine). Script POSIX sh — funciona em Debian/Ubuntu e Alpine.
#
# Instalação interativa (recomendado):
#   curl -fsSL https://github.com/diegesisvtt/diegesis-room/releases/latest/download/install.sh -o install.sh
#   sh install.sh
#
# Repositório privado? Adicione o header de autenticação nas duas chamadas
# (baixar o install.sh e depois rodá-lo com GH_TOKEN exportado):
#   curl -fsSL -H "Authorization: Bearer $GH_TOKEN" \
#     https://github.com/diegesisvtt/diegesis-room/releases/latest/download/install.sh -o install.sh
#   GH_TOKEN=$GH_TOKEN sh install.sh
#
# Instalação não-interativa (via variáveis de ambiente):
#   curl -fsSL -H "Authorization: Bearer $GH_TOKEN" \
#     https://github.com/diegesisvtt/diegesis-room/releases/latest/download/install.sh | \
#     env GH_TOKEN=$GH_TOKEN MODE=systemd LIVEKIT_URL=... LIVEKIT_API_KEY=... \
#         LIVEKIT_API_SECRET=... PUBLIC_URL=https://meu.servidor sh
#
# Opções (flags ou variáveis de ambiente):
#   --mode docker|systemd   (MODE)        Como rodar o serviço. Padrão: docker
#                                         (systemd: systemd no Linux padrão, OpenRC no Alpine)
#   --version v1.2.3        (VERSION)     Tag específica. Padrão: latest
#   --dir /opt/diegesis-room (INSTALL_DIR) Diretório de instalação
#   --port 3000             (PORT)        Porta HTTP
#   --non-interactive       (NO_PROMPT=1) Usa variáveis de ambiente, sem perguntar
#   GH_TOKEN=<token>        Token do GitHub para repos privados
# ============================================================================

REPO="diegesisvtt/diegesis-room"
APP="diegesis-room"

MODE="${MODE:-docker}"
VERSION="${VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-/opt/$APP}"
PORT="${PORT:-3000}"
NO_PROMPT="${NO_PROMPT:-0}"
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
INIT=""

usage() {
  cat <<'EOF'
Uso:
  curl -fsSL https://github.com/diegesisvtt/diegesis-room/releases/latest/download/install.sh -o install.sh
  sh install.sh

Opções (flags ou variáveis de ambiente):
  --mode docker|systemd   (MODE)        Como rodar o serviço. Padrão: docker
                                        (systemd: systemd no Linux padrão, OpenRC no Alpine)
  --version v1.2.3        (VERSION)     Tag específica. Padrão: latest
  --dir /opt/diegesis-room (INSTALL_DIR) Diretório de instalação
  --port 3000             (PORT)        Porta HTTP
  --non-interactive       (NO_PROMPT=1) Usa variáveis de ambiente, sem perguntar
  GH_TOKEN=<token>        Token do GitHub (necessário p/ repos privados)
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

# Alias de conveniência.
[ "$MODE" = "service" ] && MODE="systemd"

if [ "$MODE" != "docker" ] && [ "$MODE" != "systemd" ]; then
  die "MODE inválido: '$MODE' (use 'docker' ou 'systemd')"
fi

# stdin não é terminal (ex: curl | sh) -> assume não-interativo.
if [ ! -t 0 ]; then
  NO_PROMPT=1
fi

# ---- helpers -------------------------------------------------------------
need() { command -v "$1" >/dev/null 2>&1 || die "Comando '$1' não encontrado. Instale antes de continuar."; }

require_root() {
  [ "$(id -u)" -eq 0 ] || die "Execute como root (use sudo)."
}

prompt() {
  # $1 = texto, $2 = default. Imprime o prompt no stderr (para aparecer mesmo
  # dentro de command substitution) e devolve o valor no stdout.
  _p_text="$1"; _p_default="$2"; _p_val=""
  printf '%s' "$_p_text [${_p_default}]: " >&2
  IFS= read -r _p_val
  if [ -z "$_p_val" ]; then
    _p_val="$_p_default"
  fi
  printf '%s' "$_p_val"
}

# ---- dependências --------------------------------------------------------
need curl
need tar

if [ "$MODE" = "docker" ]; then
  need docker
  docker info >/dev/null 2>&1 || die "Docker não está acessível. O daemon está rodando?"
else
  require_root
  if command -v systemctl >/dev/null 2>&1; then
    INIT="systemd"
  elif command -v rc-service >/dev/null 2>&1; then
    INIT="openrc"
  else
    die "Não encontrei systemd nem OpenRC. Use --mode docker ou instale um init system."
  fi
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
  if [ -n "$TOKEN" ]; then
    curl -fsSL -H "Authorization: Bearer ${TOKEN}" "$URL" -o "$STAGING/pkg.tar.gz" \
      || die "Falha ao baixar o release (verifique o GH_TOKEN e se a tag/asset existe)."
  else
    curl -fsSL "$URL" -o "$STAGING/pkg.tar.gz" \
      || die "Falha ao baixar o release. Se o repositório for privado, exporte GH_TOKEN=<seu token>."
  fi
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
    # O instalador oficial (bun.sh/install) é um script bash. Em sistemas sem
    # bash (ex: Alpine), instala bash + unzip primeiro.
    if ! command -v bash >/dev/null 2>&1; then
      if command -v apk >/dev/null 2>&1; then
        apk add --no-cache bash unzip || die "Falha ao instalar bash/unzip."
      elif command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq && apt-get install -y -qq bash unzip || die "Falha ao instalar bash/unzip."
      fi
    fi
    curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash || die "Falha ao instalar Bun."
    export PATH="/usr/local/bin:$PATH"
  fi
  BUN_BIN="$(command -v bun)"
  log "Bun: $BUN_BIN"

  # Usuário dedicado (useradd no Linux padrão, adduser no Alpine).
  if ! id -u "$APP" >/dev/null 2>&1; then
    if command -v useradd >/dev/null 2>&1; then
      useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin "$APP"
    elif command -v adduser >/dev/null 2>&1; then
      adduser -S -D -H "$APP"
    else
      die "Não encontrei useradd/adduser para criar o usuário '$APP'."
    fi
  fi
  chown -R "$APP:$APP" "$INSTALL_DIR"

  if [ "$INIT" = "systemd" ]; then
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
  else
    # Wrapper que carrega o .env e executa o Bun. O OpenRC não tem
    # EnvironmentFile, então o wrapper torna o carregamento autocontido.
    cat > "${INSTALL_DIR}/run.sh" <<EOF
#!/bin/sh
cd "${INSTALL_DIR}"
set -a
. "${INSTALL_DIR}/.env"
set +a
exec "${BUN_BIN}" dist-server/index.js
EOF
    chmod 755 "${INSTALL_DIR}/run.sh"

    cat > "/etc/init.d/${APP}" <<EOF
#!/sbin/openrc-run

name="${APP}"
description="Diegesis Room"

supervisor="supervise-daemon"
command="${INSTALL_DIR}/run.sh"
command_user="${APP}"
directory="${INSTALL_DIR}"

depend() {
    need net
}
EOF
    chmod +x "/etc/init.d/${APP}"
    rc-update add "${APP}" default
    rc-service "${APP}" restart || rc-service "${APP}" start
    log "Serviço OpenRC '${APP}' iniciado."
  fi
fi

# ---- health check --------------------------------------------------------
log "Aguardando subir e checando /api/health..."
HEALTHY=0
i=1
while [ "$i" -le 30 ]; do
  if curl -fsS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  sleep 1
  i=$((i + 1))
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
