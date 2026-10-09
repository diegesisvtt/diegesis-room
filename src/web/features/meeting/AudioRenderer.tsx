import { useEffect, useRef } from "react";
import type { RemoteAudioTrack } from "livekit-client";

/**
 * Anexa uma trilha de áudio remota a um elemento <audio>. No SDK web do
 * LiveKit o áudio não toca sozinho: é preciso chamar `track.attach()` para
 * que a trilha seja reproduzida no navegador.
 */
export function AudioRenderer({ track }: { track: RemoteAudioTrack | null }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  if (!track) return null;
  return <audio ref={ref} autoPlay />;
}
