import { ArrowLeft, X } from "lucide-react";

type Props = {
  onBack?: () => void;
  backLabel?: string;
  onCancel: () => void;
  backDisabled?: boolean;
  cancelDisabled?: boolean;
};

export function StepLinks({
  onBack,
  backLabel = "Voltar",
  onCancel,
  backDisabled = false,
  cancelDisabled = false,
}: Props) {
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={backDisabled}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-bark-500 transition hover:bg-cream-200 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
      ) : (
        <span />
      )}

      <button
        type="button"
        onClick={onCancel}
        disabled={cancelDisabled}
        className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-bark-500 transition hover:bg-cream-200 disabled:opacity-40"
      >
        <X className="h-4 w-4" />
        Cancelar GTA
      </button>
    </div>
  );
}
