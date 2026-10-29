import { X } from "lucide-react";
import type { GtaStepProps } from "./types";

export function CancelStep({ actions, active }: GtaStepProps) {
  return (
    <div className="py-2 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cream-200 text-bark-500">
        <X className="h-7 w-7" />
      </div>
      <h3 className="mt-2 text-xl font-black">GTA cancelada</h3>
      <p className="mt-2 text-sm text-bark-500">Nada foi emitido.</p>
      {active && (
        <button
          type="button"
          onClick={actions.reiniciar}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-forest-700 px-4 text-sm font-extrabold text-white"
        >
          Começar de novo
        </button>
      )}
    </div>
  );
}
