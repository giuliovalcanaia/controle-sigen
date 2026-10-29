import { Loader2 } from "lucide-react";
import { gtaStageText } from "../../gta";
import type { GtaStepProps } from "./types";

export function StatusStep({ state }: GtaStepProps) {
  const { job } = state;

  return (
    <div className="flex flex-col items-center py-4 text-center">
      <Loader2 className="h-9 w-9 animate-spin text-forest-700" />
      <p className="mt-3 text-lg font-extrabold">{gtaStageText(job)}</p>

      {job && job.total > 0 && (
        <div className="mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-cream-200">
          <div
            className="h-full rounded-full bg-forest-700 transition-all"
            style={{
              width: `${Math.min(
                100,
                Math.round((job.atual / job.total) * 100),
              )}%`,
            }}
          />
        </div>
      )}

      <p className="mt-3 max-w-xs text-sm text-bark-500">
        {job?.status === "salvando"
          ? "Salvando a GTA. Não feche esta tela agora."
          : "Não feche esta tela. O progresso continua no servidor."}
      </p>

      {state.resultError && (
        <p className="mt-3 max-w-xs text-xs text-amber-800">
          {state.resultError}
        </p>
      )}
    </div>
  );
}
