import { Loader2, Search } from "lucide-react";
import { StepLinks } from "./StepLinks";
import type { GtaStepProps } from "./types";

export function CpfStep({ state, actions }: GtaStepProps) {
  return (
    <div>
      <div className="flex items-start gap-3 rounded-2xl bg-cream-100 px-3 py-3">
        <Search className="mt-0.5 h-5 w-5 shrink-0 text-forest-700" />
        <div>
          <p className="text-sm font-bold text-bark-700">
            Digite o CPF ou CNPJ no campo de mensagem abaixo.
          </p>
          <p className="mt-1 text-xs text-bark-500">
            Uso só para buscar a propriedade. O CPF não fica salvo.
          </p>
        </div>
      </div>

      {state.lookupBusy && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-bark-700">
          <Loader2 className="h-4 w-4 animate-spin text-forest-700" />
          Buscando propriedades...
        </p>
      )}

      {state.lookupError && (
        <p
          className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {state.lookupError}
        </p>
      )}

      <StepLinks
        onBack={actions.voltar}
        onCancel={actions.cancelar}
        backDisabled={state.lookupBusy}
      />
    </div>
  );
}
