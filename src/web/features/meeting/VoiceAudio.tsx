import { useVoiceRoom } from "./voiceStore";
import { AudioRenderer } from "./AudioRenderer";

/**
 * Mantém a reprodução de áudio remoto viva em qualquer rota. Antes, o áudio só
 * existia dentro do VoiceStage; agora é montado globalmente para que a sala
 * continue audível mesmo fora do canal de voz (ex.: configurações).
 */
export function VoiceAudio() {
  const voice = useVoiceRoom();
  return (
    <>
      {voice.guests.map((guest) => (
        <AudioRenderer key={guest.identity} track={guest.audioTrack} />
      ))}
    </>
  );
}
