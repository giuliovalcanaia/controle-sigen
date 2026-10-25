import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MapPin,
  Search,
  Truck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "../api";
import {
  addDaysIso,
  animalsForUep,
  buildGtaInput,
  formatDateTime,
  formatIsoBr,
  GTA_FINALIDADE_PADRAO,
  GTA_TRANSPORTE_PADRAO,
  gtaStageText,
  gtaStatusText,
  propertyUep,
  type GtaDestinoChoice,
} from "../gta";
import type {
  GtaDestinoUep,
  GtaJobView,
  GtaOptions,
  Inventory,
  PropertyInventory,
} from "../types";
import { formatAge } from "../utils";

type Step =
  | "origem"
  | "destino"
  | "animais"
  | "dados"
  | "revisao"
  | "enviando"
  | "resultado";

const STEP_ORDER: Step[] = ["origem", "destino", "animais", "dados", "revisao"];

type Props = {
  inventory: Inventory;
  open: boolean;
  onClose: () => void;
};

function gtaErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "SEM_CONEXAO") {
      return "Sem conexão com o servidor. Verifique a VPN e tente de novo.";
    }
    if (error.code === "TEMPO_ESGOTADO") {
      return "O servidor demorou demais para responder. Tente de novo.";
    }
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente de novo.";
}

export function GtaFlow({ inventory, open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("origem");
  const [options, setOptions] = useState<GtaOptions | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [origem, setOrigem] = useState<PropertyInventory | null>(null);
  const [origemUep, setOrigemUep] = useState("");
  const [destino, setDestino] = useState<GtaDestinoChoice | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [finalidade, setFinalidade] = useState("");
  const [dataSaida, setDataSaida] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [transporte, setTransporte] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [placa, setPlaca] = useState("");
  const [lacre, setLacre] = useState("");
  const [observacao, setObservacao] = useState("");
  const [cpf, setCpf] = useState("");
  const [destinos, setDestinos] = useState<GtaDestinoUep[]>([]);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<GtaJobView | null>(null);
  const [startError, setStartError] = useState("");
  const [startErrorCode, setStartErrorCode] = useState("");
  const [history, setHistory] = useState<GtaJobView[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("origem");
    setOrigem(null);
    setOrigemUep("");
    setDestino(null);
    setSelected(new Set());
    setFinalidade("");
    setDataSaida("");
    setDataValidade("");
    setTransporte("");
    setNotaFiscal("");
    setPlaca("");
    setLacre("");
    setObservacao("");
    setCpf("");
    setDestinos([]);
    setLookupBusy(false);
    setLookupError("");
    setJobId(null);
    setJob(null);
    setStartError("");
    setStartErrorCode("");
    setPdfUrl(null);
  }, []);

  const applyDefaults = useCallback((next: GtaOptions) => {
    setFinalidade(
      next.finalidades.includes(GTA_FINALIDADE_PADRAO)
        ? GTA_FINALIDADE_PADRAO
        : next.finalidades[0] ?? "",
    );
    setDataSaida(next.hoje);
    setDataValidade(next.validadePadrao);
    setTransporte(
      next.transportes.includes(GTA_TRANSPORTE_PADRAO)
        ? GTA_TRANSPORTE_PADRAO
        : next.transportes[0] ?? "",
    );
  }, []);

  const loadOptions = useCallback(async () => {
    setOptionsError("");
    try {
      const next = await api.getGtaOptions();
      setOptions(next);
      applyDefaults(next);
    } catch (error) {
      setOptions(null);
      setOptionsError(gtaErrorText(error));
    }
  }, [applyDefaults]);

  const loadHistory = useCallback(async () => {
    try {
      const { gtas } = await api.listGtas();
      setHistory(gtas);
    } catch {
      // O histórico é um extra; a emissão não depende dele.
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      reset();
      void loadOptions();
      void loadHistory();
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, reset, loadOptions, loadHistory]);

  useEffect(() => {
    if (!jobId || step !== "enviando") return;

    let active = true;
    const tick = async () => {
      try {
        const next = await api.getGta(jobId);
        if (!active) return;
        setJob(next);
        setStartError("");
        if (
          ["emitida", "conferida", "erro", "incerta"].includes(next.status)
        ) {
          setPdfUrl(next.temPdf ? api.gtaPdfUrl(jobId) : null);
          setStep("resultado");
          setHistory((previous) =>
            [next, ...previous.filter((item) => item.id !== next.id)].slice(0, 5),
          );
        }
      } catch (error) {
        if (active) setStartError(gtaErrorText(error));
      }
    };

    void tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [jobId, step]);

  const animals = useMemo(
    () => (origem ? animalsForUep(origem, origemUep) : []),
    [origem, origemUep],
  );
  const selectedAnimals = useMemo(
    () => animals.filter((animal) => selected.has(animal.key)),
    [animals, selected],
  );
  const allSelected =
    animals.length > 0 && animals.every((animal) => selected.has(animal.key));

  const destinoLabel = useMemo(() => {
    if (!destino) return "";
    if (destino.tipo === "propria") {
      return `${destino.property.localidade} · ${destino.property.codigo}`;
    }
    return `${destino.uep.localidade} · ${destino.uep.codigoOficial}`;
  }, [destino]);

  function selectOrigem(property: PropertyInventory) {
    setOrigem(property);
    setOrigemUep(propertyUep(property));
    setDestino(null);
    setSelected(new Set());
    setStep("destino");
  }

  function selectDestinoProprio(property: PropertyInventory) {
    setDestino({ tipo: "propria", property, uep: propertyUep(property) });
    setSelected(new Set());
    setStep("animais");
  }

  function selectDestinoTerceiro(uep: GtaDestinoUep) {
    setDestino({ tipo: "terceiro", cpf: cpf.replace(/\D/g, ""), uep });
    setSelected(new Set());
    setStep("animais");
  }

  async function lookupDestinos() {
    const digits = cpf.replace(/\D/g, "");
    if (!/^\d{11}$|^\d{14}$/.test(digits)) {
      setLookupError("Digite um CPF ou CNPJ válido.");
      return;
    }

    setLookupBusy(true);
    setLookupError("");
    setDestinos([]);
    try {
      const { ueps } = await api.lookupGtaDestinos(digits, dataSaida);
      const filtradas = ueps.filter(
        (uep) => !uep.uf || !options?.uf || uep.uf === options.uf,
      );
      setDestinos(filtradas);
      if (filtradas.length === 0) {
        setLookupError(
          "Nenhuma propriedade bovina em Santa Catarina encontrada para este CPF.",
        );
      }
    } catch (error) {
      setLookupError(gtaErrorText(error));
    } finally {
      setLookupBusy(false);
    }
  }

  function toggleAnimal(key: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      allSelected ? new Set() : new Set(animals.map((animal) => animal.key)),
    );
  }

  function goBack() {
    if (step === "destino") setStep("origem");
    else if (step === "animais") setStep("destino");
    else if (step === "dados") setStep("animais");
    else if (step === "revisao") setStep("dados");
  }

  async function start(modo: "conferir" | "emitir", forcar = false) {
    if (!origem || !destino || selectedAnimals.length === 0) return;

    const input = buildGtaInput({
      origem,
      origemUep,
      destino,
      animais: selectedAnimals,
      finalidade,
      dataSaida,
      dataValidade,
      transporte,
      notaFiscal,
      placa,
      lacre,
      observacao,
    });

    const quantidade = selectedAnimals.length;
    const confirmText =
      modo === "emitir"
        ? `${
            forcar ? "Emitir outra GTA mesmo assim? " : ""
          }Emitir a GTA de ${quantidade} ${
            quantidade === 1 ? "animal" : "animais"
          } agora? Depois de emitida, não dá para desfazer pelo app.`
        : "Conferir esta GTA no SIGEN? Nada será emitido.";
    if (!window.confirm(confirmText)) return;

    setStartError("");
    setStartErrorCode("");
    setJob(null);
    setJobId(null);
    setPdfUrl(null);
    setStep("enviando");

    try {
      const { id } = await api.startGta({ gta: input, modo, forcar });
      setJobId(id);
    } catch (error) {
      setStep("revisao");
      setStartError(gtaErrorText(error));
      setStartErrorCode(error instanceof ApiError ? error.code : "");
    }
  }

  function emitAnother() {
    reset();
    if (options) applyDefaults(options);
  }

  function requestClose() {
    if (step === "enviando" && job?.status === "salvando") return;
    if (
      step === "enviando" &&
      !window.confirm(
        "A GTA continua sendo processada no servidor. Sair agora? Você pode conferir depois em “Últimas GTAs”.",
      )
    ) {
      return;
    }
    onClose();
  }

  const stepIndex = STEP_ORDER.indexOf(step);
  const canGoBack =
    step === "destino" ||
    step === "animais" ||
    step === "dados" ||
    step === "revisao";
  const title = (() => {
    switch (step) {
      case "origem":
        return "De qual propriedade?";
      case "destino":
        return "Para onde vão?";
      case "animais":
        return "Quais animais?";
      case "dados":
        return "Dados da GTA";
      case "revisao":
        return "Confira antes de emitir";
      case "enviando":
        return options?.emissaoAtiva ? "Emitindo a GTA" : "Conferindo no SIGEN";
      case "resultado":
        return "Resultado";
    }
  })();

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      className="m-0 h-full max-h-none w-full max-w-none bg-cream-50 p-0 text-bark-700 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px] sm:m-auto sm:h-auto sm:max-h-[92dvh] sm:max-w-lg sm:rounded-3xl"
      aria-labelledby="gta-title"
    >
      <div className="flex h-[100dvh] flex-col sm:h-auto sm:max-h-[92dvh]">
        <header className="safe-top flex items-start gap-2 border-b border-cream-200 bg-white/70 px-3 py-3 sm:px-4">
          {canGoBack ? (
            <button
              type="button"
              onClick={goBack}
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-bark-500 transition hover:bg-cream-200"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="h-10 w-10 shrink-0" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
              {stepIndex >= 0 && stepIndex < STEP_ORDER.length
                ? `GTA · etapa ${stepIndex + 1} de ${STEP_ORDER.length}`
                : "GTA"}
            </p>
            <h2 id="gta-title" className="truncate text-xl font-black">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={requestClose}
            disabled={step === "enviando" && job?.status === "salvando"}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-bark-500 transition hover:bg-cream-200 disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {step === "origem" && (
            <section>
              <p className="text-sm text-bark-500">
                Escolha de onde saem os animais. Propriedades sem animais
                aparecem desabilitadas.
              </p>

              {!options && (
                <div className="mt-4 rounded-2xl border border-cream-200 bg-white/70 p-4">
                  {optionsError ? (
                    <>
                      <p className="text-sm text-red-800">{optionsError}</p>
                      <button
                        type="button"
                        onClick={() => void loadOptions()}
                        className="mt-3 inline-flex h-10 items-center rounded-full bg-forest-700 px-4 text-sm font-bold text-white"
                      >
                        Tentar de novo
                      </button>
                    </>
                  ) : (
                    <p className="flex items-center gap-2 text-sm font-semibold text-bark-700">
                      <Loader2 className="h-4 w-4 animate-spin text-forest-700" />
                      Carregando as opções da GTA...
                    </p>
                  )}
                </div>
              )}

              {options && (
                <div className="mt-3 space-y-2">
                  {inventory.propriedades.map((property) => {
                    const count = property.animais.length;
                    return (
                      <button
                        key={property.codigo}
                        type="button"
                        disabled={count === 0}
                        onClick={() => selectOrigem(property)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-cream-200 bg-white/80 px-4 py-3 text-left shadow-sm transition active:scale-[0.99] disabled:opacity-50"
                      >
                        <MapPin className="h-5 w-5 shrink-0 text-forest-700" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-extrabold">
                            {property.localidade}
                          </span>
                          <span className="block truncate text-xs text-bark-500">
                            {property.codigo} · {property.municipio}/{property.uf}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-forest-700/10 px-2.5 py-1 text-xs font-bold text-forest-800">
                          {count === 0
                            ? "Sem animais"
                            : `${count} ${count === 1 ? "animal" : "animais"}`}
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-bark-500" />
                      </button>
                    );
                  })}
                </div>
              )}

              {history.length > 0 && (
                <section className="mt-6">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-bark-500">
                    <History className="h-3.5 w-3.5" />
                    Últimas GTAs
                  </p>
                  <ul className="mt-2 space-y-2">
                    {history.slice(0, 5).map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-cream-200 bg-white/70 px-3 py-2 text-xs"
                      >
                        <span className="min-w-0">
                          <span className="block font-bold">
                            {gtaStatusText(item.status)}
                            {item.numero ? ` · nº ${item.numero}` : ""}
                          </span>
                          <span className="block text-bark-500">
                            {formatDateTime(item.criadaEm)}
                          </span>
                        </span>
                        {item.temPdf && (
                          <a
                            href={api.gtaPdfUrl(item.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forest-700/10 px-3 py-1.5 font-bold text-forest-800"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            PDF
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </section>
          )}

          {step === "destino" && (
            <section>
              <p className="text-sm text-bark-500">
                Escolha a propriedade que vai receber os animais.
              </p>

              <div className="mt-3 space-y-2">
                {inventory.propriedades
                  .filter((property) => property.codigo !== origem?.codigo)
                  .map((property) => (
                    <button
                      key={property.codigo}
                      type="button"
                      onClick={() => selectDestinoProprio(property)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-cream-200 bg-white/80 px-4 py-3 text-left shadow-sm transition active:scale-[0.99]"
                    >
                      <MapPin className="h-5 w-5 shrink-0 text-forest-700" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-extrabold">
                          {property.localidade}
                        </span>
                        <span className="block truncate text-xs text-bark-500">
                          {property.codigo} · {property.municipio}/{property.uf}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-bark-500" />
                    </button>
                  ))}
              </div>

              <div className="mt-5 rounded-3xl border border-cream-200 bg-white/70 p-4">
                <p className="font-extrabold">Outra pessoa</p>
                <p className="mt-1 text-xs text-bark-500">
                  Busque pela propriedade usando o CPF ou CNPJ do produtor.
                </p>

                <div className="mt-3 flex gap-2">
                  <input
                    value={cpf}
                    onChange={(event) =>
                      setCpf(event.target.value.replace(/[^\d]/g, ""))
                    }
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="CPF ou CNPJ"
                    aria-label="CPF ou CNPJ do produtor de destino"
                    className="min-w-0 flex-1 rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                  />
                  <button
                    type="button"
                    onClick={() => void lookupDestinos()}
                    disabled={lookupBusy}
                    className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-forest-700 px-4 text-sm font-extrabold text-white disabled:opacity-60"
                  >
                    {lookupBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Buscar
                  </button>
                </div>

                {lookupError && (
                  <p className="mt-2 text-sm text-red-800" role="alert">
                    {lookupError}
                  </p>
                )}

                {destinos.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {destinos.map((uep) => (
                      <li key={`${uep.codigoOficial}-${uep.uep}`}>
                        <button
                          type="button"
                          onClick={() => selectDestinoTerceiro(uep)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-left"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">
                              {uep.localidade}
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
                )}
              </div>
            </section>
          )}

          {step === "animais" && (
            <section>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-sm text-bark-500">
                  {origem?.localidade} → {destinoLabel}
                </p>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="shrink-0 rounded-full border border-cream-200 bg-white px-3 py-1.5 text-xs font-bold text-forest-800"
                >
                  {allSelected ? "Limpar" : "Selecionar todos"}
                </button>
              </div>

              <ul className="mt-3 space-y-2">
                {animals.map((animal) => (
                  <li key={animal.key}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-cream-200 bg-white/80 px-3 py-2.5 transition hover:border-forest-700/20">
                      <input
                        type="checkbox"
                        checked={selected.has(animal.key)}
                        onChange={() => toggleAnimal(animal.key)}
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

              {animals.length === 0 && (
                <p className="mt-4 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-bark-500">
                  Esta propriedade não tem animais para emitir.
                </p>
              )}
            </section>
          )}

          {step === "dados" && (
            <section className="space-y-4">
              <label className="block">
                <span className="text-sm font-bold">Finalidade</span>
                <select
                  value={finalidade}
                  onChange={(event) => setFinalidade(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                >
                  {options?.finalidades.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-bold">Data da saída</span>
                  <input
                    type="date"
                    value={dataSaida}
                    min={options?.hoje}
                    max={addDaysIso(options?.hoje ?? dataSaida, 30)}
                    onChange={(event) => setDataSaida(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold">Validade</span>
                  <input
                    type="date"
                    value={dataValidade}
                    min={dataSaida ? addDaysIso(dataSaida, 1) : undefined}
                    max={dataSaida ? addDaysIso(dataSaida, 30) : undefined}
                    onChange={(event) => setDataValidade(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-bold">Transporte</span>
                <select
                  value={transporte}
                  onChange={(event) => setTransporte(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                >
                  {options?.transportes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <details className="rounded-2xl border border-cream-200 bg-white/70 p-4">
                <summary className="cursor-pointer text-sm font-bold">
                  Nota fiscal, placa, lacre e observação (opcional)
                </summary>
                <div className="mt-3 space-y-3">
                  <input
                    value={notaFiscal}
                    onChange={(event) => setNotaFiscal(event.target.value)}
                    placeholder="Nº da nota fiscal"
                    aria-label="Número da nota fiscal"
                    className="w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                  />
                  <input
                    value={placa}
                    onChange={(event) => setPlaca(event.target.value)}
                    placeholder="Placa do veículo"
                    aria-label="Placa do veículo"
                    className="w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base uppercase outline-none focus:border-forest-700/40"
                  />
                  <input
                    value={lacre}
                    onChange={(event) => setLacre(event.target.value)}
                    placeholder="Lacre"
                    aria-label="Lacre"
                    className="w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                  />
                  <textarea
                    value={observacao}
                    onChange={(event) => setObservacao(event.target.value)}
                    rows={3}
                    maxLength={5000}
                    placeholder="Observação"
                    aria-label="Observação"
                    className="w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                  />
                </div>
              </details>
            </section>
          )}

          {step === "revisao" && (
            <section className="space-y-3">
              <div className="rounded-2xl border border-cream-200 bg-white/80 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
                  Trajeto
                </p>
                <p className="mt-1 font-extrabold">{origem?.localidade}</p>
                <p className="text-sm text-bark-500">
                  {origem?.codigo} · UEP {origemUep}
                </p>
                <p className="my-1 text-bark-500">↓</p>
                <p className="font-extrabold">{destinoLabel}</p>
                {destino?.tipo === "terceiro" && destino.uep.produtor && (
                  <p className="text-sm text-bark-500">
                    {destino.uep.produtor}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-cream-200 bg-white/80 p-4">
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

              <div className="rounded-2xl border border-cream-200 bg-white/80 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
                  Dados
                </p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-bark-500">Finalidade</dt>
                  <dd className="font-semibold">{finalidade}</dd>
                  <dt className="text-bark-500">Saída</dt>
                  <dd className="font-semibold">{formatIsoBr(dataSaida)}</dd>
                  <dt className="text-bark-500">Validade</dt>
                  <dd className="font-semibold">{formatIsoBr(dataValidade)}</dd>
                  <dt className="text-bark-500">Transporte</dt>
                  <dd className="font-semibold">{transporte}</dd>
                  {notaFiscal.trim() && (
                    <>
                      <dt className="text-bark-500">Nota fiscal</dt>
                      <dd className="font-semibold">{notaFiscal}</dd>
                    </>
                  )}
                  {placa.trim() && (
                    <>
                      <dt className="text-bark-500">Placa</dt>
                      <dd className="font-semibold">{placa.toUpperCase()}</dd>
                    </>
                  )}
                  {lacre.trim() && (
                    <>
                      <dt className="text-bark-500">Lacre</dt>
                      <dd className="font-semibold">{lacre}</dd>
                    </>
                  )}
                  {observacao.trim() && (
                    <>
                      <dt className="text-bark-500">Observação</dt>
                      <dd className="font-semibold">{observacao}</dd>
                    </>
                  )}
                </dl>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {options?.emissaoAtiva
                    ? "A GTA é um documento oficial do CIDASC. Depois de emitida, não dá para desfazer pelo app."
                    : "Modo conferência: o app vai preencher a tela do SIGEN e parar antes de salvar. Nada será emitido."}
                </p>
              </div>

              {startError && (
                <p
                  className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {startError}
                </p>
              )}

              {startErrorCode === "GTA_JA_EMITIDA" && options?.emissaoAtiva && (
                <button
                  type="button"
                  onClick={() => void start("emitir", true)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 text-sm font-bold text-amber-900"
                >
                  Emitir outra mesmo assim
                </button>
              )}
            </section>
          )}

          {step === "enviando" && (
            <section className="flex flex-col items-center py-8 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-forest-700" />
              <p className="mt-4 text-lg font-extrabold">{gtaStageText(job)}</p>

              {job && job.total > 0 && (
                <div className="mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-cream-200">
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

              {startError && (
                <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
                  {startError}
                </p>
              )}
            </section>
          )}

          {step === "resultado" && (
            <section className="flex flex-col items-center py-4 text-center">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full ${
                  job?.status === "emitida"
                    ? "bg-emerald-100 text-emerald-700"
                    : job?.status === "conferida"
                      ? "bg-forest-700/10 text-forest-800"
                      : job?.status === "incerta"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                }`}
              >
                {job?.status === "emitida" || job?.status === "conferida" ? (
                  <CheckCircle2 className="h-8 w-8" />
                ) : (
                  <AlertTriangle className="h-8 w-8" />
                )}
              </div>

              <h3 className="mt-3 text-2xl font-black">
                {job?.status === "emitida"
                  ? "GTA emitida"
                  : job?.status === "conferida"
                    ? "Conferência concluída"
                    : job?.status === "incerta"
                      ? "Confira no SIGEN"
                      : "Não foi possível emitir"}
              </h3>

              <p className="mt-2 max-w-sm text-sm text-bark-500">
                {job?.status === "emitida"
                  ? "A GTA foi registrada no SIGEN."
                  : job?.status === "conferida"
                    ? "Nada foi emitido. O SIGEN aceitou os dados desta GTA."
                    : job?.status === "incerta"
                      ? "A GTA pode ter sido emitida. Confira no SIGEN antes de tentar de novo."
                      : job?.erro ?? "Tente de novo."}
              </p>

              {job?.status === "emitida" && job.numero && (
                <p className="mt-4 rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-lg font-black">
                  Nº {job.numero}
                </p>
              )}

              {job?.status === "emitida" && !job.numero && (
                <p className="mt-3 text-sm text-bark-500">
                  O SIGEN não devolveu o número. Confira em “Últimas GTAs” ou
                  no próprio SIGEN.
                </p>
              )}

              {job?.status === "emitida" && pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white"
                >
                  <ExternalLink className="h-5 w-5" />
                  Abrir GTA (PDF)
                </a>
              )}

              {job?.status === "emitida" && !pdfUrl && (
                <p className="mt-3 text-sm text-bark-500">
                  O PDF não está disponível. Imprima pelo SIGEN.
                </p>
              )}

              <div className="mt-6 flex w-full flex-col gap-2">
                {(job?.status === "emitida" || job?.status === "conferida") && (
                  <button
                    type="button"
                    onClick={emitAnother}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white"
                  >
                    {options?.emissaoAtiva ? "Emitir outra" : "Conferir outra"}
                  </button>
                )}

                {job?.status === "erro" && (
                  <button
                    type="button"
                    onClick={() => setStep("revisao")}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white"
                  >
                    Voltar e corrigir
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 items-center justify-center rounded-2xl text-sm font-bold text-bark-500 transition hover:bg-cream-200"
                >
                  Fechar
                </button>
              </div>
            </section>
          )}
        </div>

        {(step === "animais" || step === "dados" || step === "revisao") && (
          <footer className="safe-bottom border-t border-cream-200 bg-cream-50/95 px-4 pb-3 pt-3 backdrop-blur sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-cream-200 bg-white px-5 text-sm font-bold text-bark-500 sm:w-32"
              >
                Voltar
              </button>

              {step === "animais" && (
                <button
                  type="button"
                  onClick={() => setStep("dados")}
                  disabled={selected.size === 0}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white disabled:opacity-50"
                >
                  {selected.size === 0
                    ? "Escolha os animais"
                    : `Continuar com ${selected.size}`}
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}

              {step === "dados" && (
                <button
                  type="button"
                  onClick={() => setStep("revisao")}
                  disabled={!finalidade || !dataSaida || !dataValidade || !transporte}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white disabled:opacity-50"
                >
                  Revisar
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}

              {step === "revisao" && (
                <button
                  type="button"
                  onClick={() =>
                    void start(options?.emissaoAtiva ? "emitir" : "conferir")
                  }
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white"
                >
                  {options?.emissaoAtiva ? (
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
              )}
            </div>
          </footer>
        )}
      </div>
    </dialog>
  );
}
