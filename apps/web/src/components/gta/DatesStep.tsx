import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import {
  addDaysIso,
  formatIsoBr,
  GTA_MAX_DIAS_VALIDADE,
} from "../../gta";
import { saidaValida, validadeValida } from "../../gtaFlow";
import { StepLinks } from "./StepLinks";
import type { GtaStepProps } from "./types";

export function DatesStep({ state, actions }: GtaStepProps) {
  const saidaOk = saidaValida(state);
  const validadeOk = validadeValida(state);
  const { options } = state;

  return (
    <div>
      <p className="text-sm text-bark-500">
        Deixei o padrão pronto. Toque em um item para alterar.
      </p>

      <div className="mt-3 divide-y divide-cream-200 rounded-2xl border border-cream-200 bg-white/80">
        <DataRow
          label="Finalidade"
          value={state.finalidade || "Escolher"}
          open={state.editingField === "finalidade"}
          onToggle={() => actions.alternarCampo("finalidade")}
        >
          <select
            value={state.finalidade}
            onChange={(event) => actions.mudarFinalidade(event.target.value)}
            aria-label="Finalidade da GTA"
            className="w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
          >
            {options?.finalidades.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </DataRow>

        <DataRow
          label="Saída"
          value={
            state.dataSaida
              ? options && state.dataSaida === options.hoje
                ? `Hoje · ${formatIsoBr(state.dataSaida)}`
                : formatIsoBr(state.dataSaida)
              : "Escolher"
          }
          open={state.editingField === "saida"}
          onToggle={() => actions.alternarCampo("saida")}
        >
          <input
            type="date"
            value={state.dataSaida}
            min={options?.hoje}
            max={
              options
                ? addDaysIso(options.hoje, GTA_MAX_DIAS_VALIDADE)
                : undefined
            }
            onChange={(event) => actions.mudarSaida(event.target.value)}
            aria-label="Data da saída"
            className="w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
          />
        </DataRow>

        <DataRow
          label="Validade"
          value={
            state.dataValidade ? formatIsoBr(state.dataValidade) : "Escolher"
          }
          open={state.editingField === "validade"}
          onToggle={() => actions.alternarCampo("validade")}
        >
          <input
            type="date"
            value={state.dataValidade}
            min={
              state.dataSaida
                ? addDaysIso(state.dataSaida, 1)
                : undefined
            }
            max={
              state.dataSaida
                ? addDaysIso(state.dataSaida, GTA_MAX_DIAS_VALIDADE)
                : undefined
            }
            onChange={(event) => actions.mudarValidade(event.target.value)}
            aria-label="Validade da GTA"
            className="w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
          />
        </DataRow>

        <DataRow
          label="Transporte"
          value={state.transporte || "Escolher"}
          open={state.editingField === "transporte"}
          onToggle={() => actions.alternarCampo("transporte")}
        >
          <select
            value={state.transporte}
            onChange={(event) => actions.mudarTransporte(event.target.value)}
            aria-label="Meio de transporte"
            className="w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
          >
            {options?.transportes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </DataRow>
      </div>

      {(!saidaOk || !validadeOk) && (
        <p className="mt-2 text-xs font-semibold text-amber-800">
          {!saidaOk
            ? "A saída precisa ser hoje ou nos próximos 30 dias."
            : "A validade precisa ser depois da saída, em até 30 dias."}
        </p>
      )}

      <button
        type="button"
        onClick={actions.continuarDatas}
        disabled={
          !state.finalidade ||
          !saidaOk ||
          !validadeOk ||
          !state.transporte
        }
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white disabled:opacity-50"
      >
        Continuar
        <ChevronRight className="h-5 w-5" />
      </button>

      <StepLinks onBack={actions.voltar} onCancel={actions.cancelar} />
    </div>
  );
}

/** Linha do cartão de datas: mostra o valor e abre o editor ao tocar. */
function DataRow({
  label,
  value,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="px-3 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="shrink-0 text-sm text-bark-500">{label}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-bark-700">
          <span className="truncate">{value}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-bark-500 transition ${
              open ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
