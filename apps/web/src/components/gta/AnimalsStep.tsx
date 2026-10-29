import { ChevronRight, Loader2 } from "lucide-react";
import type { GtaOriginUnit } from "../../gta";
import { formatAge } from "../../utils";
import { StepLinks } from "./StepLinks";
import type { GtaStepProps } from "./types";

export function AnimalsStep({
  state,
  units,
  origin,
  originKey,
  actions,
}: GtaStepProps) {
  function grupoCompleto(unit: GtaOriginUnit): boolean {
    return (
      unit.animals.length > 0 &&
      unit.animals.every((animal) => state.selected.has(animal.key))
    );
  }

  return (
    <div>
      {units.length === 0 ? (
        <p className="rounded-2xl bg-cream-100 px-4 py-3 text-sm text-bark-500">
          Você não tem animais para emitir GTA.
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-cream-100 px-3 py-2">
            <p className="min-w-0 text-xs font-semibold leading-snug text-bark-700">
              {origin
                ? `Origem: ${origin.property.localidade} · UEP ${origin.uep}`
                : "Marque os animais que vão sair."}
            </p>
            {origin && (
              <button
                type="button"
                onClick={actions.limparSelecao}
                className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-forest-800 shadow-sm"
              >
                Trocar
              </button>
            )}
          </div>

          <div>
            {units.map((unit) => {
              const blocked = Boolean(originKey && unit.key !== originKey);
              const every = grupoCompleto(unit);

              return (
                <section
                  key={unit.key}
                  aria-disabled={blocked}
                  className={blocked ? "opacity-45" : ""}
                >
                  <div className="flex items-center justify-between gap-2 pb-1.5 pt-2">
                    <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-forest-800">
                      {unit.property.localidade} · UEP {unit.uep}
                    </p>
                    <button
                      type="button"
                      onClick={() => actions.alternarGrupo(unit.key)}
                      disabled={blocked}
                      className="shrink-0 rounded-full px-2 py-1 text-[11px] font-bold text-forest-700 transition hover:bg-forest-700/10 disabled:opacity-50"
                    >
                      {every ? "Limpar" : "Todos"}
                    </button>
                  </div>

                  <ul className="space-y-2">
                    {unit.animals.map((animal) => (
                      <li key={animal.key}>
                        <label
                          className={`flex items-center gap-3 rounded-2xl border border-cream-200 bg-white/80 px-3 py-2.5 transition ${
                            blocked
                              ? "cursor-not-allowed"
                              : "cursor-pointer hover:border-forest-700/20"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={state.selected.has(animal.key)}
                            onChange={() =>
                              actions.selecionarAnimal(unit.key, animal.key)
                            }
                            disabled={blocked}
                            className="h-5 w-5 shrink-0 accent-forest-700"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-extrabold">
                              {animal.apelido?.trim() || "Sem apelido"}
                            </span>
                            <span className="block text-sm text-bark-500">
                              Brinco {animal.brinco} · {animal.sexo} ·{" "}
                              {formatAge(animal.idade)}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-bark-500">
            Uma GTA só leva animais de uma propriedade e UEP.
          </p>

          {state.optionsBusy && (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-bark-700">
              <Loader2 className="h-4 w-4 animate-spin text-forest-700" />
              Carregando opções da GTA...
            </p>
          )}

          {state.optionsError && (
            <div className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-800">
              <p>{state.optionsError}</p>
              <button
                type="button"
                onClick={actions.recarregarOpcoes}
                className="mt-2 inline-flex h-9 items-center rounded-full bg-white px-3 text-xs font-bold text-red-800 shadow-sm"
              >
                Tentar de novo
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={actions.continuarAnimais}
            disabled={
              state.selected.size === 0 || !state.options || state.optionsBusy
            }
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white disabled:opacity-50"
          >
            {state.selected.size === 0
              ? "Escolha os animais"
              : `Continuar com ${state.selected.size}`}
            <ChevronRight className="h-5 w-5" />
          </button>

          <StepLinks onCancel={actions.cancelar} />
        </>
      )}

      {units.length === 0 && <StepLinks onCancel={actions.cancelar} />}
    </div>
  );
}
