import { useCallback, useEffect, useState } from "react";
import { api, type AuthUser } from "@/web/lib/api";

let cached: AuthUser | null | undefined;
let inflight: Promise<AuthUser | null> | null = null;
const listeners = new Set<(user: AuthUser | null) => void>();

async function fetchUser(): Promise<AuthUser | null> {
  if (!inflight) {
    inflight = api
      .me()
      .then(({ user }) => {
        cached = user;
        for (const fn of listeners) fn(user);
        return user;
      })
      .catch(() => {
        cached = null;
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function setAuthUser(user: AuthUser | null) {
  cached = user;
  for (const fn of listeners) fn(user);
}

export function useAuth(): { user: AuthUser | null; loading: boolean; refresh: () => Promise<AuthUser | null> } {
  const [user, setUser] = useState<AuthUser | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    const listener = (next: AuthUser | null) => setUser(next);
    listeners.add(listener);
    if (cached === undefined) {
      void fetchUser().finally(() => setLoading(false));
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(() => fetchUser(), []);
  return { user, loading, refresh };
}
