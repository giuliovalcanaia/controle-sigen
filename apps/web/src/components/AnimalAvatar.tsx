import { Beef } from "lucide-react";
import { useState } from "react";
import type { Animal } from "../types";

type Props = {
  animal: Animal;
  onOpen: () => void;
};

/** Círculo do animal: foto quando existe, senão a inicial ou o ícone de boi. */
export function AnimalAvatar({ animal, onOpen }: Props) {
  const [failed, setFailed] = useState(false);
  const nome = animal.apelido?.trim();
  const inicial = (nome || animal.brinco).slice(0, 1).toUpperCase();
  const temFoto = animal.fotoVersao !== null && !failed;
  const quem = nome ?? `brinco ${animal.brinco}`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-700/10 text-sm font-black text-forest-800 ring-1 ring-inset ring-forest-700/10 transition active:scale-95"
      aria-label={`Foto de ${quem}`}
      title="Foto do animal"
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
    </button>
  );
}
