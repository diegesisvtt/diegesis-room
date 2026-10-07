export type SessionRole = "host" | "guest";

export type Session = {
  name: string;
  role: SessionRole;
  campaignId: string;
  characterName?: string | null;
  photoUrl?: string | null;
};

const KEY = "diegesis.session";
const TOKENS_KEY = "diegesis.profileTokens";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function ensureName(): string {
  const existing = loadSession()?.name;
  return existing ?? "";
}

/** Nome exibido para os outros participantes: "Nome · Personagem". */
export function displayName(session: Pick<Session, "name" | "characterName">): string {
  const character = session.characterName?.trim();
  return character ? `${session.name} · ${character}` : session.name;
}

/**
 * Token que identifica o perfil do participante em uma campanha no servidor.
 * Gerado uma vez por campanha e guardado no navegador — é o que faz o perfil
 * sobreviver a refresh e a voltar outro dia.
 */
export function getProfileToken(campaignId: string): string {
  const tokens = loadTokens();
  const existing = tokens[campaignId];
  if (existing) return existing;
  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  tokens[campaignId] = token;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  return token;
}

function loadTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}
