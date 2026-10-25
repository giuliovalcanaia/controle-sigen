import { Loader2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Animal } from "../types";

type Props = {
  animal: Animal | null;
  onClose: () => void;
  onSave: (apelido: string | null) => Promise<void>;
  onRemovePhoto: () => Promise<void>;
};

export function NicknameDialog({ animal, onClose, onSave, onRemovePhoto }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (animal) {
      setValue(animal.apelido ?? "");
      setError("");
      setSaving(false);
      setRemoving(false);
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [animal]);

  async function save(apelido: string | null) {
    if (saving || removing) return;
    setSaving(true);
    setError("");
    try {
      await onSave(apelido);
      dialogRef.current?.close();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não consegui salvar o apelido.");
      setSaving(false);
    }
  }

  async function removePhoto() {
    if (saving || removing) return;
    setRemoving(true);
    setError("");
    try {
      await onRemovePhoto();
      dialogRef.current?.close();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não consegui remover a foto.");
      setRemoving(false);
    }
  }

  const willRemove = value.trim().length === 0 && Boolean(animal?.apelido);
  const canSubmit = saving || removing ? false : value.trim().length > 0 || Boolean(animal?.apelido);
  const busy = saving || removing;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-cream-200 bg-cream-50 p-0 text-bark-700 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
      aria-labelledby="nickname-title"
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim().length > 0) {
            void save(value.trim());
          } else if (animal?.apelido) {
            void save(null);
          }
        }}
      >
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
              Editar animal
            </p>
            <h2 id="nickname-title" className="mt-0.5 text-2xl font-black">
              {animal ? `Brinco ${animal.brinco}` : ""}
            </h2>
            <p className="mt-1 text-sm text-bark-500">
              Use o nome que você chama esse animal no dia a dia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-bark-500 transition hover:bg-cream-200"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-5 pt-4">
          <label htmlFor="nickname-input" className="sr-only">
            Apelido
          </label>
          <input
            id="nickname-input"
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={40}
            placeholder="Ex.: Mimosa, Estrela, Preta"
            className="w-full rounded-2xl border border-cream-200 bg-white px-4 py-3.5 text-lg font-semibold outline-none ring-forest-700/20 focus:ring-4"
            enterKeyHint="done"
          />
          <div className="mt-1.5 flex justify-between text-xs text-bark-500">
            <span>Até 40 caracteres</span>
            <span>{value.length}/40</span>
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}

          {animal?.fotoVersao != null && (
            <button
              type="button"
              onClick={() => void removePhoto()}
              disabled={busy}
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-sm font-bold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
            >
              {removing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remover foto
            </button>
          )}
        </div>

        <footer className="flex flex-col gap-2 px-5 pb-5 pt-4">
          <button
            type="submit"
            disabled={!canSubmit}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-base font-extrabold transition active:scale-[0.99] disabled:bg-cream-200 disabled:text-bark-500 ${
              willRemove ? "bg-red-700 text-white" : "bg-forest-700 text-white"
            }`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {willRemove ? "Remover apelido" : "Salvar apelido"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-11 rounded-2xl text-sm font-bold text-bark-500 transition hover:bg-cream-200 disabled:opacity-50"
          >
            Cancelar
          </button>
        </footer>
      </form>
    </dialog>
  );
}
