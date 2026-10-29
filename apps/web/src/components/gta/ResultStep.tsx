import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { api } from "../../api";
import { resultadoDaGta } from "../../gtaFlow";
import type { GtaStepProps } from "./types";

export function ResultStep({
  state,
  origin,
  actions,
  active,
}: GtaStepProps) {
  const { status, incerta, concluida, naoEmitida, podeTentarDeNovo } =
    resultadoDaGta(state);
  const podeAjustar =
    (status === "erro" || naoEmitida) &&
    !incerta &&
    Boolean(origin && state.destino);
  const job = state.job;

  return (
    <div className="flex flex-col items-center py-2 text-center">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full ${
          concluida
            ? "bg-emerald-100 text-emerald-700"
            : incerta
              ? "bg-amber-100 text-amber-700"
              : naoEmitida
                ? "bg-stone-200 text-stone-600"
                : "bg-red-100 text-red-700"
        }`}
      >
        {concluida ? (
          <CheckCircle2 className="h-7 w-7" />
        ) : (
          <AlertTriangle className="h-7 w-7" />
        )}
      </div>

      <h3 className="mt-2 text-xl font-black">
        {status === "emitida"
          ? "GTA emitida"
          : status === "conferida"
            ? "Conferência concluída"
            : status === "nao_emitida"
              ? "GTA não emitida"
              : incerta
                ? "Confira no SIGEN"
                : "Não foi possível emitir"}
      </h3>

      <p className="mt-2 max-w-sm text-sm text-bark-500">
        {status === "emitida"
          ? "A GTA foi registrada no SIGEN."
          : status === "conferida"
            ? "Nada foi emitido. O SIGEN aceitou os dados desta GTA."
            : status === "nao_emitida"
              ? "Você conferiu no SIGEN e a GTA não foi emitida. Pode tentar de novo."
              : incerta
                ? job
                  ? "A GTA pode ter sido emitida. Confira no SIGEN antes de tentar de novo."
                  : state.resultError ||
                    "Já existe uma GTA incerta para esta viagem. Confira no SIGEN."
                : job?.erro ?? state.resultError ?? "Tente de novo."}
      </p>

      {status === "emitida" && job?.numero && (
        <p className="mt-3 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-lg font-black">
          Nº {job.numero}
        </p>
      )}

      {status === "emitida" && !job?.numero && (
        <p className="mt-2 text-xs text-bark-500">
          Número não informado. Confira no SIGEN.
        </p>
      )}

      {status === "emitida" && job?.temPdf && job && (
        <a
          href={api.gtaPdfUrl(job.id)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-forest-700 px-4 text-sm font-extrabold text-white"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir GTA (PDF)
        </a>
      )}

      {status === "emitida" && !job?.temPdf && (
        <p className="mt-2 text-xs text-bark-500">
          O PDF não está disponível. Imprima pelo SIGEN.
        </p>
      )}

      {status === "incerta" && job && (
        <div className="mt-4 w-full rounded-2xl border border-amber-200 bg-white/80 p-3 text-left">
          <p className="text-sm font-bold text-bark-700">
            {state.resultCode === "GTA_INCERTA"
              ? "GTA anterior desta viagem. Confira no SIGEN e responda:"
              : "Confira a GTA no SIGEN e responda:"}
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => actions.resolver("emitida")}
              disabled={state.resolving}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-forest-700 px-4 text-sm font-extrabold text-white disabled:opacity-50"
            >
              Foi emitida
            </button>
            <button
              type="button"
              onClick={() => actions.resolver("nao_emitida")}
              disabled={state.resolving}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-cream-200 bg-white px-4 text-sm font-bold text-bark-700 disabled:opacity-50"
            >
              Não foi emitida
            </button>
          </div>
          {state.resolveError && (
            <p className="mt-2 text-xs font-semibold text-red-700">
              {state.resolveError}
            </p>
          )}
        </div>
      )}

      {active && (
        <div className="mt-4 flex w-full flex-col gap-2">
          {concluida && (
            <button
              type="button"
              onClick={actions.reiniciar}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-forest-700 px-4 text-sm font-extrabold text-white"
            >
              {state.options?.emissaoAtiva ? "Fazer outra GTA" : "Conferir outra"}
            </button>
          )}

          {podeTentarDeNovo && (
            <button
              type="button"
              onClick={actions.iniciar}
              disabled={state.starting}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-forest-700 px-4 text-sm font-extrabold text-white disabled:opacity-50"
            >
              Tentar de novo
            </button>
          )}

          {podeAjustar && (
            <button
              type="button"
              onClick={actions.ajustar}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-cream-200 bg-white px-4 text-sm font-bold text-bark-500"
            >
              Voltar e ajustar
            </button>
          )}

          {status === "erro" && !incerta && (
            <button
              type="button"
              onClick={actions.reiniciar}
              className="inline-flex h-10 items-center justify-center rounded-2xl text-sm font-bold text-bark-500 transition hover:bg-cream-200"
            >
              Fazer outra GTA
            </button>
          )}
        </div>
      )}
    </div>
  );
}
