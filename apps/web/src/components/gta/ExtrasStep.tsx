import { StepLinks } from "./StepLinks";
import type { GtaStepProps } from "./types";

export function ExtrasStep({ actions }: GtaStepProps) {
  return (
    <div>
      <p className="text-base font-semibold leading-snug text-bark-700">
        Quer informar a nota fiscal ou a placa do veículo?
      </p>
      <p className="mt-1 text-xs text-bark-500">
        Os dois são opcionais. Se não tiver, pode pular.
      </p>

      <button
        type="button"
        onClick={() => actions.responderExtras(true)}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white"
      >
        Sim
      </button>

      <button
        type="button"
        onClick={() => actions.responderExtras(false)}
        className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-cream-200 bg-white px-5 text-base font-bold text-bark-700"
      >
        Não
      </button>

      <StepLinks onBack={actions.voltar} onCancel={actions.cancelar} />
    </div>
  );
}
