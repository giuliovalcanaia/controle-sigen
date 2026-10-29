import { ChevronRight, MapPin } from "lucide-react";
import { StepLinks } from "./StepLinks";
import type { GtaStepProps } from "./types";

export function UepStep({ state, actions }: GtaStepProps) {
  return (
    <div>
      {state.destinos.length > 0 ? (
        <ul className="max-h-[46dvh] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {state.destinos.map((uep) => (
            <li key={uep.id || `${uep.codigoOficial}-${uep.uep}`}>
              <button
                type="button"
                onClick={() => actions.escolherUep(uep)}
                className="flex w-full items-center gap-3 rounded-2xl border border-cream-200 bg-white/80 px-3 py-2.5 text-left transition hover:border-forest-700/20"
              >
                <MapPin className="h-5 w-5 shrink-0 text-forest-700" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">
                    {uep.localidade} · UEP {uep.uep}
                  </span>
                  <span className="block truncate text-xs text-bark-500">
                    {uep.codigoOficial} · {uep.municipio}/{uep.uf}
                    {uep.produtor ? ` · ${uep.produtor}` : ""}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-bark-500" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-cream-100 px-3 py-2 text-sm text-bark-500">
          Nenhuma propriedade encontrada.
        </p>
      )}

      <StepLinks
        onBack={actions.voltar}
        backLabel="Trocar CPF"
        onCancel={actions.cancelar}
      />
    </div>
  );
}
