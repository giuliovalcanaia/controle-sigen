import { Pencil, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api";
import { preparePhoto } from "../photo";
import type { Animal, Inventory } from "../types";
import { formatAge, formatTime } from "../utils";
import { AnimalAvatar } from "./AnimalAvatar";

type Props = {
  inventory: Inventory;
  onEdit: (animal: Animal) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onPhotoSaved: (animalKey: string, fotoVersao: number) => void;
};

function photoErrorText(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.code === "SEM_CONEXAO") {
      return "Sem conexão com o servidor. A foto não foi enviada.";
    }
    if (cause.code === "TEMPO_ESGOTADO") {
      return "A foto demorou demais para subir. Tente de novo.";
    }
    return cause.message;
  }
  return cause instanceof Error
    ? cause.message
    : "Não consegui enviar a foto. Tente de novo.";
}

export function InventoryCard({
  inventory,
  onEdit,
  onRefresh,
  refreshing,
  onPhotoSaved,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Animal | null>(null);
  const busyRef = useRef(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const propriedadesComAnimais = inventory.propriedades.filter(
    (property) => property.animais.length > 0,
  ).length;
  const semAnimais = inventory.propriedades.length - propriedadesComAnimais;

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 6000);
    return () => window.clearTimeout(timer);
  }, [error]);

  function pickPhoto(animal: Animal) {
    if (uploadingKey) return;
    pendingRef.current = animal;
    inputRef.current?.click();
  }

  async function upload(file: File | undefined) {
    const animal = pendingRef.current;
    pendingRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
    // Um upload por vez: se o navegador disparar o evento duas vezes,
    // a segunda chamada não sobe a mesma foto de novo.
    if (!file || !animal || busyRef.current) return;

    busyRef.current = true;
    setError("");
    setUploadingKey(animal.key);
    try {
      const foto = await preparePhoto(file);
      const { fotoVersao } = await api.setPhoto(animal.key, foto);
      onPhotoSaved(animal.key, fotoVersao);
    } catch (cause) {
      setError(photoErrorText(cause));
    } finally {
      busyRef.current = false;
      setUploadingKey(null);
    }
  }

  return (
    <article className="message-enter overflow-hidden rounded-3xl border border-cream-200 bg-cream-50 shadow-sm">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void upload(event.target.files?.[0])}
      />

      <header className="flex items-start justify-between gap-3 border-b border-cream-200 bg-white/70 px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
            Inventário bovino
          </p>
          <h2 className="mt-0.5 text-3xl font-black tracking-tight text-bark-700">
            {inventory.total} {inventory.total === 1 ? "animal" : "animais"}
          </h2>
          <p className="mt-0.5 text-sm text-bark-500">
            em {propriedadesComAnimais}{" "}
            {propriedadesComAnimais === 1 ? "propriedade" : "propriedades"}
            {semAnimais > 0
              ? ` · ${semAnimais} ${semAnimais === 1 ? "propriedade" : "propriedades"} sem animais`
              : ""}
            {" · "}
            atualizado às {formatTime(inventory.buscadoEm)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cream-200 bg-white text-forest-700 shadow-sm transition active:scale-95 disabled:opacity-50"
          aria-label="Atualizar inventário"
          title="Atualizar"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-900"
        >
          {error}
        </div>
      )}

      {inventory.avisos.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          Algumas propriedades não puderam ser lidas agora.
        </div>
      )}

      <div className="divide-y divide-cream-200">
        {inventory.propriedades.map((property) => (
          <section key={property.codigo} className="px-4 py-4 sm:px-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-extrabold text-bark-700">
                  {property.localidade}
                </h3>
                <p className="truncate text-xs text-bark-500">
                  {property.codigo} · {property.municipio}/{property.uf}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-forest-700/10 px-2.5 py-1 text-xs font-bold text-forest-800">
                {property.animais.length}
              </span>
            </div>

            {property.animais.length === 0 ? (
              <p className="rounded-2xl bg-cream-100 px-4 py-3 text-sm text-bark-500">
                Sem animais nesta propriedade.
              </p>
            ) : (
              <ul className="space-y-2">
                {property.animais.map((animal) => (
                  <AnimalRow
                    key={animal.key}
                    animal={animal}
                    uploading={uploadingKey === animal.key}
                    onPick={() => pickPhoto(animal)}
                    onEdit={() => onEdit(animal)}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <footer className="border-t border-cream-200 bg-white/60 px-5 py-3 text-[11px] text-bark-500">
        Dados do SIGEN+ · o número em destaque é o brinco de manejo.
      </footer>
    </article>
  );
}

function AnimalRow({
  animal,
  uploading,
  onPick,
  onEdit,
}: {
  animal: Animal;
  uploading: boolean;
  onPick: () => void;
  onEdit: () => void;
}) {
  const nome = animal.apelido?.trim();

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-transparent bg-white/70 px-3 py-2.5 transition hover:border-cream-200">
      <AnimalAvatar animal={animal} uploading={uploading} onPick={onPick} />
      <div className="min-w-0 flex-1">
        <p className={`truncate font-extrabold ${nome ? "text-bark-700" : "text-bark-500"}`}>
          {nome || "Sem apelido"}
        </p>
        <p className="text-sm leading-snug text-bark-500">
          <span className="block font-semibold text-bark-700">Brinco {animal.brinco}</span>
          <span className="block">
            {animal.sexo} · {formatAge(animal.idade)}
          </span>
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-forest-700 transition hover:bg-forest-700/10 active:scale-95"
        aria-label={nome ? `Editar apelido de ${nome}` : `Dar apelido ao brinco ${animal.brinco}`}
      >
        <Pencil className="h-[18px] w-[18px]" />
      </button>
    </li>
  );
}
