import { ImagePlus, Loader2, Maximize2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api";
import type { Animal } from "../types";

type Props = {
  animal: Animal | null;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
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

/** Foto do animal: ver em tela cheia, trocar ou remover. */
export function PhotoDialog({ animal, onClose, onUpload, onRemove }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fullRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState("");
  const [full, setFull] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (animal) {
      setError("");
      setBusy(null);
      if (!dialog.open) dialog.showModal();
    } else {
      setFull(false);
      if (dialog.open) dialog.close();
    }
  }, [animal]);

  useEffect(() => {
    const dialog = fullRef.current;
    if (!dialog) return;

    if (full) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [full]);

  const url = animal?.fotoVersao
    ? `/api/photos/${encodeURIComponent(animal.key)}?v=${animal.fotoVersao}`
    : null;
  const nome = animal?.apelido?.trim();
  const titulo = nome ?? (animal ? `Brinco ${animal.brinco}` : "");
  const trabalhando = busy !== null;

  async function upload(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file || trabalhando) return;

    setError("");
    setBusy("upload");
    try {
      await onUpload(file);
    } catch (cause) {
      setError(photoErrorText(cause));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (trabalhando) return;
    if (!window.confirm("Remover a foto deste animal?")) return;

    setError("");
    setBusy("remove");
    try {
      await onRemove();
    } catch (cause) {
      setError(photoErrorText(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          if (!trabalhando) onClose();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-cream-200 bg-cream-50 p-0 text-bark-700 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
        aria-labelledby="photo-title"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void upload(event.target.files?.[0])}
        />

        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
              Foto do animal
            </p>
            <h2 id="photo-title" className="mt-0.5 truncate text-2xl font-black">
              {titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => !trabalhando && onClose()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-bark-500 transition hover:bg-cream-200"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-5 pt-4">
          {url ? (
            <button
              type="button"
              onClick={() => setFull(true)}
              className="relative block w-full overflow-hidden rounded-2xl bg-cream-100"
              aria-label="Ver a foto em tela cheia"
            >
              <img
                src={url}
                alt={`Foto de ${titulo}`}
                className="aspect-square w-full object-cover"
              />
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                <Maximize2 className="h-3.5 w-3.5" />
                Ver maior
              </span>
            </button>
          ) : (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-bark-500/30 bg-cream-100 px-6 text-center text-bark-500">
              <ImagePlus className="h-8 w-8" />
              <p className="text-sm">Este animal ainda não tem foto.</p>
            </div>
          )}

          {busy === "upload" && (
            <p className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-bark-700">
              <Loader2 className="h-4 w-4 animate-spin text-forest-700" />
              Enviando a foto...
            </p>
          )}

          {error && (
            <p
              className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-col gap-2 px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={trabalhando}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy === "upload" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
            {url ? "Trocar foto" : "Adicionar foto"}
          </button>

          {url && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={trabalhando}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-sm font-bold text-red-800 transition hover:bg-red-100 disabled:opacity-60"
            >
              {busy === "remove" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remover foto
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={trabalhando}
            className="h-11 rounded-2xl text-sm font-bold text-bark-500 transition hover:bg-cream-200 disabled:opacity-50"
          >
            Fechar
          </button>
        </footer>
      </dialog>

      <dialog
        ref={fullRef}
        onCancel={(event) => {
          event.preventDefault();
          setFull(false);
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-black p-0 backdrop:bg-black"
        aria-label={`Foto de ${titulo} em tela cheia`}
      >
        <div className="relative flex h-full w-full items-center justify-center">
          {url && (
            <img
              src={url}
              alt={`Foto de ${titulo}`}
              className="max-h-full max-w-full object-contain"
            />
          )}
          <button
            type="button"
            onClick={() => setFull(false)}
            className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
            aria-label="Fechar foto"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </dialog>
    </>
  );
}
