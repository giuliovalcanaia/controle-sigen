import { ChevronRight } from "lucide-react";
import { StepLinks } from "./StepLinks";
import type { GtaStepProps } from "./types";

type Props = GtaStepProps & { mode: "nota" | "placa" };

export function NotePlateStep({ state, actions, mode }: Props) {
  const nota = mode === "nota";

  return (
    <div>
      <label className="block">
        <span className="text-sm font-bold">
          {nota ? "Número da nota fiscal" : "Placa do veículo"}
        </span>
        <input
          autoFocus
          value={nota ? state.notaFiscal : state.placa}
          onChange={(event) =>
            nota
              ? actions.mudarNotaFiscal(event.target.value)
              : actions.mudarPlaca(event.target.value)
          }
          maxLength={nota ? 30 : 10}
          placeholder={nota ? "Ex.: 12345" : "Ex.: ABC1D23"}
          aria-label={nota ? "Número da nota fiscal" : "Placa do veículo"}
          autoCapitalize={nota ? undefined : "characters"}
          autoComplete={nota ? undefined : "off"}
          className="mt-1 w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
        />
      </label>
      <p className="mt-1 text-xs text-bark-500">
        {nota
          ? "Opcional. Se não tiver nota fiscal, toque em Continuar sem preencher."
          : "Opcional. Se não souber a placa, toque em Continuar sem preencher."}
      </p>

      <button
        type="button"
        onClick={nota ? actions.continuarNotaFiscal : actions.continuarPlaca}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white"
      >
        Continuar
        <ChevronRight className="h-5 w-5" />
      </button>

      <StepLinks onBack={actions.voltar} onCancel={actions.cancelar} />
    </div>
  );
}
