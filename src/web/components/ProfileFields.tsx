import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { fileToAvatarDataUrl } from "@/web/lib/image";
import { initials } from "@/web/lib/utils";
import { Input } from "@/web/components/ui/input";

export type ProfileFieldsValue = {
  name: string;
  characterName: string;
  /** data URL de uma foto recém-escolhida (ainda não enviada) */
  photoDataUrl: string | null;
  /** URL da foto já salva no servidor */
  photoUrl: string | null;
};

export function ProfileFields({
  value,
  onChange,
  autoFocusName = false,
}: {
  value: ProfileFieldsValue;
  onChange: (next: ProfileFieldsValue) => void;
  autoFocusName?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const preview = value.photoDataUrl ?? value.photoUrl;

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setProcessing(true);
    try {
      const photoDataUrl = await fileToAvatarDataUrl(file);
      onChange({ ...value, photoDataUrl });
    } catch {
      /* imagem inválida — ignora */
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold ring-1 ring-accent/25 transition-all duration-200 hover:ring-accent/60 hover:shadow-[var(--shadow-glow-gold)]"
          aria-label="Escolher foto"
        >
          {preview ? (
            <img src={preview} alt="Foto do perfil" className="size-full object-cover" />
          ) : (
            initials(value.name) || "?"
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 backdrop-blur-[1px] transition-all duration-200 group-hover:opacity-100">
            {processing ? (
              <Loader2 className="size-5 animate-spin text-gold-bright" />
            ) : (
              <Camera className="size-5 text-gold-bright drop-shadow-[0_0_8px_var(--color-accent)]" />
            )}
          </span>
        </button>
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Foto de perfil</p>
          <p>Opcional. Aparece na mesa e nos canais.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            void pickPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Seu nome</label>
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Como os outros vão te ver"
          autoFocus={autoFocusName}
          maxLength={60}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Nome do personagem</label>
        <Input
          value={value.characterName}
          onChange={(e) => onChange({ ...value, characterName: e.target.value })}
          placeholder="Ex.: Thorin Escudo-de-Carvalho"
          maxLength={60}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Opcional. Aparece como “{value.name.trim() || "Nome"} · {value.characterName.trim() || "Personagem"}” na mesa.
        </p>
      </div>
    </div>
  );
}
