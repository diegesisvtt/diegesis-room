# Diegesis Room

Sala de conferência para RPG de mesa, híbrida (jogadores presenciais + remotos), com recursos
que unem o melhor do **Zoom** (vídeo, compartilhamento de tela, câmera dedicada ao mapa físico,
sala de espera, modo streaming) e do **Discord** (canais de texto persistentes, mesas de voz, convites por link).

> Nome inspirado em *diegesis* — o mundo ficcional narrado na mesa.

## Funcionalidades

- **Mesas de voz/vídeo** via [LiveKit](https://livekit.io): cada canal de voz vira uma sala.
- **Modo híbrido**: câmera dedicada apontada para a mesa física (a "câmera do mapa") no palco
  principal + jogadores remotos na faixa lateral.
- **Compartilhamento de tela** (PC) como tile central fixável — ideal para mapas digitais.
- **Modo streaming** (`/stream/:channelId`): exibe os jogadores remotos em tela cheia para a televisão
  da mesa, com indicador de quem está falando. Token de audiência (só assiste, não publica).
- **Discord-like**: campanhas, canais de texto com histórico persistente (WebSocket) e canais de voz.
- **Convites por link** (sem conta): jogador entra pelo nome; anfitrião entra direto.
- **Sala de espera**: jogadores aguardam aprovação do anfitrião.
- **Sessão**: chat ao vivo, mão levantada, reações, rolagem de dados (d4/d6/d8/d20), moderação
  (silenciar/remover).
- **Configuração do LiveKit pela interface** (Settings), com fallback para variáveis de ambiente.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Backend | Elysia (Bun) |
| Runtime | Bun |
| Banco | SQLite (`bun:sqlite`) + Drizzle ORM |
| IDs | UUID v7 (`uuidv7`) |
| Áudio/Vídeo | LiveKit (server SDK + client) |

## Estrutura (feature-based)

```
src/
├── server/                 # Elysia + SQLite
│   ├── index.ts            # entrypoint: plugins, rotas, WS, serve estático
│   ├── db/                 # client + schema + migrate
│   ├── lib/                # livekit (token/moderação), settings, seed
│   └── modules/
│       ├── campaigns/      # campanhas (CRUD)
│       ├── channels/       # canais texto/voz
│       ├── invites/        # links de convite
│       ├── rooms/          # token LiveKit, sala de espera, moderação
│       ├── chat/           # mensagens (REST + WebSocket)
│       └── settings/       # config LiveKit (GET/PUT)
└── web/                    # React + Vite
    ├── main.tsx / router.tsx / styles.css
    ├── components/ui/      # kit de UI (shadcn-style)
    ├── lib/                # api client, session, utils
    └── features/
        ├── landing/        # criar campanha / entrar por link
        ├── join/           # resolver convite + nome
        ├── campaign/       # layout: sidebar + canal ativo
        ├── chat/           # canal de texto persistente
        ├── meeting/        # palco de vídeo, controles, participantes, dispositivos
        ├── dice/           # rolagens
        ├── tv-mode/        # página /stream para o modo streaming
        └── settings/       # config LiveKit na UI
```

## Começando

Pré-requisitos: [Bun](https://bun.sh) ≥ 1.1.

```sh
bun install
cp .env.example .env   # opcional (LiveKit pode ser configurado pela UI)
bun run dev            # Elysia em :3000 + Vite em :5173 (com proxy)
```

Abra <http://localhost:5173>. No primeiro boot, uma campanha de exemplo
("Crônicas de Astar") é criada automaticamente.

### Scripts

| Comando | Descrição |
| --- | --- |
| `bun run dev` | Sobe backend (watch) e frontend (Vite) juntos |
| `bun run build` | Compila o frontend para `dist/` e o servidor para `dist-server/` |
| `bun run start` | Roda o servidor de produção (serve API + estáticos) |
| `bun run db:generate` | Gera migration do Drizzle |
| `bun run db:migrate` | Aplica migrations |
| `bun run typecheck` | `tsc --noEmit` |

## LiveKit

O áudio/vídeo usa LiveKit. Você pode configurar de duas formas:

1. **Pela UI** — em **Configurações** no app (persistido no SQLite).
2. **Por variáveis de ambiente** — `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

Sem credenciais, o app roda em **modo demonstração** (participantes simulados, controles locais).

### Self-hosted (Docker)

```sh
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  livekit/livekit-server --dev
```

URL (para a máquina da mesa): `http://localhost:7880` (ou `http://<ip-da-rede>:7880`).
Use a API key/secret impressos no terminal. Para jogadores **fora** da sua rede, prefira
LiveKit Cloud ou exponha a porta com STUN/TURN adequados.

### LiveKit Cloud

Crie um projeto em <https://cloud.livekit.io> e cole a URL (`wss://...`) e as credenciais.

## Como usar (fluxo híbrido)

1. **Anfitrião** cria a campanha (ou abre pelo link de anfitrião), entra na mesa de voz,
   liga a "câmera do mapa" e, se quiser, compartilha a tela.
2. **Jogadores remotos** abrem o link de convite, informam o nome e entram na sala de espera.
3. **Anfitrião** admite os jogadores (painel Participantes).
4. **Streaming da mesa**: anfitrião clica em **Abrir modo streaming** (ou abre
   `http://<servidor>/stream/<channelId>` direto no navegador da TV) para exibir os jogadores
   remotos em tela cheia.

## Deploy (release + instalação no servidor)

O release é automatizado por GitHub Actions (`.github/workflows/release.yml`). Ao publicar
uma tag `v*` na `main`, ele builda o app, empacota num `.tar.gz` e publica um GitHub Release
com os assets (`diegesis-room-<versão>.tar.gz`, `diegesis-room.tar.gz`, `install.sh` e `SHA256SUMS.txt`).

### Criando um release

```sh
# 1. Ajuste a versão no package.json (deve bater com a tag)
# 2. Commit + tag + push
git add -A && git commit -m "chore: release v0.2.0"
git tag v0.2.0
git push origin v0.2.0   # dispara o workflow de release
```

> A tag precisa apontar para um commit na `main`, e a versão do `package.json` deve
> coincidir com o número da tag (ex: `v0.2.0` ↔ `"version": "0.2.0"`).

### Instalando no servidor (um comando)

```sh
# Interativo (pergunta LiveKit / URL pública)
curl -fsSL https://github.com/diegesisvtt/diegesis-room/releases/latest/download/install.sh -o install.sh
sh install.sh
```

> **Repositório privado?** O download dos assets exige autenticação. Use um token
> (PAT com escopo `repo` ou fine-grained com "Contents: Read"):
>
> ```sh
> curl -fsSL -H "Authorization: Bearer $GH_TOKEN" \
>   https://github.com/diegesisvtt/diegesis-room/releases/latest/download/install.sh -o install.sh
> GH_TOKEN=$GH_TOKEN sh install.sh
> ```

O script detecta o ambiente e suporta três formas de rodar:

| Modo | Comando | Requisito |
| --- | --- | --- |
| Docker (padrão) | `sh install.sh` | Docker instalado |
| systemd (Linux padrão) | `MODE=systemd sh install.sh` | systemd; Bun é instalado automaticamente |
| OpenRC (Alpine) | `MODE=systemd sh install.sh` | Alpine/OpenRC; Bun é instalado automaticamente |

O `MODE=systemd` detecta automaticamente o init system (systemd ou OpenRC). Outras opções
via flag ou variável de ambiente: `--version v0.2.0`, `--dir /opt/diegesis-room`,
`--port 3000`, `--non-interactive`.

Instalação não-interativa (CI/scripts):

```sh
curl -fsSL https://github.com/diegesisvtt/diegesis-room/releases/latest/download/install.sh | \
  env MODE=systemd LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... \
      PUBLIC_URL=https://meu.dominio sh
```

### Atualizando

Rode o mesmo comando de instalação. O script preserva o `.env` e o `data/` (SQLite) e
recarrega o serviço. Para rollback, instale uma versão específica com `--version v0.1.0`.

## Notas de implementação

- O chat de **canal de texto** é persistente (SQLite + WebSocket com broadcast em memória).
  O chat de **sessão** (dentro da mesa) é efêmero, via canal de dados do LiveKit.
- A "câmera do mapa" é a câmera local do anfitrião; o compartilhamento de tela aparece como
  tile central fixável.
- Rolagens de dados são publicadas no chat de sessão via LiveKit.
- Moderação (silenciar/remover) usa o `RoomServiceClient` do LiveKit.
