import { Beef, Camera, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Animal } from "../types";

type Props = {
  animal: Animal;
  uploading: boolean;
  onPick: () => void;
};

/** Círculo do animal: foto quando existe, senão a inicial ou o ícone de boi. */
export function AnimalAvatar({ animal, uploading, onPick }: Props) {
  const [failed, setFailed] = useState(false);
  const nome = animal.apelido?.trim();
  const inicial = (nome || animal.brinco).slice(0, 1).toUpperCase();
  const temFoto = animal.fotoVersao !== null && !failed;
  const quem = nome ?? `brinco ${animal.brinco}`;

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={uploading}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-700/10 text-sm font-black text-forest-800 ring-1 ring-inset ring-forest-700/10 transition active:scale-95 disabled:active:scale-100"
      aria-label={temFoto ? `Trocar foto de ${quem}` : `Adicionar foto de ${quem}`}
      title={temFoto ? "Trocar foto" : "Adicionar foto"}
    >
      {temFoto ? (
        <img
          src={`/api/photos/${encodeURIComponent(animal.key)}?v=${animal.fotoVersao}`}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : nome ? (
        inicial
      ) : (
        <Beef className="h-5 w-5" />
      )}

      {uploading ? (
        <span className="absolute inset-0 flex items-center justify-center bg-bark-700/60 text-white">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      ) : (
        <span
          className="absolute bottom-0 right-0 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-forest-700 text-white ring-2 ring-cream-50"
          aria-hidden="true"
        >
          <Camera className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
