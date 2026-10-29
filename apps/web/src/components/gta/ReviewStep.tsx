import { AlertTriangle, Check, Truck } from "lucide-react";
import { formatIsoBr } from "../../gta";
import { StepLinks } from "./StepLinks";
import type { GtaStepProps } from "./types";

export function ReviewStep({
  state,
  origin,
  selectedAnimals,
  actions,
}: GtaStepProps) {
  if (!origin || !state.destino || !state.options) return null;

  const { options, destino } = state;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-cream-200 bg-white/80 p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
          Trajeto
        </p>
        <p className="mt-1 font-extrabold">{origin.property.localidade}</p>
        <p className="text-sm text-bark-500">
          {origin.property.codigo} · UEP {origin.uep}
        </p>
        <p className="my-1 text-bark-500">↓</p>
        <p className="font-extrabold">
          {destino.uep.localidade} · UEP {destino.uep.uep}
        </p>
        <p className="text-sm text-bark-500">
          {destino.uep.codigoOficial} · {destino.uep.municipio}/
          {destino.uep.uf}
          {destino.uep.produtor ? ` · ${destino.uep.produtor}` : ""}
        </p>
      </div>

      <div className="rounded-2xl border border-cream-200 bg-white/80 p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
          Animais ({selectedAnimals.length})
        </p>
        <ul className="mt-2 space-y-1">
          {selectedAnimals.map((animal) => (
            <li key={animal.key} className="text-sm">
              <span className="font-bold">
                {animal.apelido?.trim() || "Sem apelido"}
              </span>{" "}
              · Brinco {animal.brinco}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-cream-200 bg-white/80 p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
          Dados
        </p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-bark-500">Finalidade</dt>
          <dd className="font-semibold">{state.finalidade}</dd>
          <dt className="text-bark-500">Saída</dt>
          <dd className="font-semibold">{formatIsoBr(state.dataSaida)}</dd>
          <dt className="text-bark-500">Validade</dt>
          <dd className="font-semibold">{formatIsoBr(state.dataValidade)}</dd>
          <dt className="text-bark-500">Transporte</dt>
          <dd className="font-semibold">{state.transporte}</dd>
          <dt className="text-bark-500">Nota fiscal</dt>
          <dd className="font-semibold">
            {state.notaFiscal.trim() || "Em branco"}
          </dd>
          <dt className="text-bark-500">Placa</dt>
          <dd className="font-semibold">
            {state.placa.trim() ? state.placa.toUpperCase() : "Em branco"}
          </dd>
          {state.lacre.trim() && (
            <>
              <dt className="text-bark-500">Lacre</dt>
              <dd className="font-semibold">{state.lacre}</dd>
            </>
          )}
          {state.observacao.trim() && (
            <>
              <dt className="text-bark-500">Observação</dt>
              <dd className="font-semibold">{state.observacao}</dd>
            </>
          )}
        </dl>
      </div>

      <details className="rounded-2xl border border-cream-200 bg-white/70 p-3">
        <summary className="cursor-pointer text-sm font-bold">
          Lacre e observação (opcional)
        </summary>
        <div className="mt-3 space-y-2">
          <input
            value={state.lacre}
            onChange={(event) => actions.mudarLacre(event.target.value)}
            maxLength={30}
            placeholder="Lacre"
            aria-label="Lacre"
            className="w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
          />
          <textarea
            value={state.observacao}
            onChange={(event) => actions.mudarObservacao(event.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Observação"
            aria-label="Observação"
            className="w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
          />
        </div>
      </details>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {options.emissaoAtiva
            ? "A GTA é um documento oficial do CIDASC. Depois de emitida, não dá para desfazer pelo app."
            : "Modo conferência: o app vai preencher a tela do SIGEN e parar antes de salvar. Nada será emitido."}
        </p>
      </div>

      {options.emissaoAtiva && (
        <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-amber-200 bg-white/80 px-3 py-2.5 text-sm font-semibold text-bark-700">
          <input
            type="checkbox"
            checked={state.confirmed}
            onChange={(event) => actions.confirmar(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-forest-700"
          />
          Entendi que a GTA é um documento oficial e não pode ser desfeita pelo
          app.
        </label>
      )}

      <button
        type="button"
        onClick={actions.iniciar}
        disabled={state.starting || (options.emissaoAtiva && !state.confirmed)}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white disabled:opacity-50"
      >
        {options.emissaoAtiva ? (
          <>
            <Truck className="h-5 w-5" />
            Emitir GTA
          </>
        ) : (
          <>
            <Check className="h-5 w-5" />
            Conferir no SIGEN
          </>
        )}
      </button>

      <StepLinks onBack={actions.voltar} onCancel={actions.cancelar} />
    </div>
  );
}
