import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
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
  animalSelectionSummary,
  buildGtaInput,
  buildOriginUnits,
  formatIsoBr,
  GTA_FINALIDADE_PADRAO,
  GTA_MAX_DIAS_VALIDADE,
  GTA_TRANSPORTE_PADRAO,
  GTA_VALIDADE_DIAS,
  gtaStageText,
  maskDocumento,
  originKeyForSelection,
  type GtaOriginUnit,
} from "../gta";
import type { GtaDestinoUep, GtaJobView, GtaOptions, Inventory } from "../types";
import { formatAge } from "../utils";
import { AssistantBubble, AssistantShell, UserBubble } from "./ChatBubble";

type Phase =
  | "animais"
  | "cpf"
  | "uep"
  | "finalidade"
  | "dataSaida"
  | "dataValidade"
  | "transporte"
  | "notaFiscal"
  | "placa"
  | "revisao"
  | "status"
  | "resultado"
  | "cancelado";

type DestinoTerceiro = {
  tipo: "terceiro";
  cpf: string;
  uep: GtaDestinoUep;
};

type ChatEntry = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

type Props = {
  inventory: Inventory;
  /** Só a conversa mais recente pode interagir e iniciar outra emissão. */
  active: boolean;
  onBusyChange: (busy: boolean) => void;
  onTextRequest: (
    handler: ((text: string) => void) | null,
    prompt?: string,
  ) => void;
  onRestart: () => void;
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

function StepLinks({
  onBack,
  backLabel = "Voltar",
  onCancel,
  backDisabled = false,
  cancelDisabled = false,
}: {
  onBack?: () => void;
  backLabel?: string;
  onCancel: () => void;
  backDisabled?: boolean;
  cancelDisabled?: boolean;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={backDisabled}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-bark-500 transition hover:bg-cream-200 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
      ) : (
        <span />
      )}

      <button
        type="button"
        onClick={onCancel}
        disabled={cancelDisabled}
        className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-bark-500 transition hover:bg-cream-200 disabled:opacity-40"
      >
        <X className="h-4 w-4" />
        Cancelar GTA
      </button>
    </div>
  );
}

export function GtaChat({
  inventory,
  active,
  onBusyChange,
  onTextRequest,
  onRestart,
}: Props) {
  const mounted = useRef(true);
  const cancelled = useRef(false);
  const historyId = useRef(2);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const originUnits = useMemo(() => buildOriginUnits(inventory), [inventory]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const selectedAnimals = useMemo(
    () =>
      originUnits
        .flatMap((unit) => unit.animals)
        .filter((animal) => selected.has(animal.key)),
    [originUnits, selected],
  );

  // A GTA tem uma única origem: o primeiro animal marcado define a
  // propriedade/UEP, e o resto da lista fica travado nela.
  const originKey = useMemo(
    () => originKeyForSelection(originUnits, selected),
    [originUnits, selected],
  );
  const origin = originUnits.find((unit) => unit.key === originKey) ?? null;

  const [history, setHistory] = useState<ChatEntry[]>([
    {
      id: 1,
      role: "assistant",
      text: "Vamos fazer a GTA. Quais animais vão sair?",
    },
  ]);
  const [phase, setPhase] = useState<Phase>("animais");

  const [options, setOptions] = useState<GtaOptions | null>(null);
  const [optionsBusy, setOptionsBusy] = useState(true);
  const [optionsError, setOptionsError] = useState("");

  const [cpf, setCpf] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [destinos, setDestinos] = useState<GtaDestinoUep[]>([]);
  const [destino, setDestino] = useState<DestinoTerceiro | null>(null);

  const [finalidade, setFinalidade] = useState(GTA_FINALIDADE_PADRAO);
  const [dataSaida, setDataSaida] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [transporte, setTransporte] = useState(GTA_TRANSPORTE_PADRAO);
  const [notaFiscal, setNotaFiscal] = useState("");
  const [placa, setPlaca] = useState("");
  const [lacre, setLacre] = useState("");
  const [observacao, setObservacao] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [jobId, setJobId] = useState<number | null>(null);
  const [job, setJob] = useState<GtaJobView | null>(null);
  const [resultError, setResultError] = useState("");
  const [resultCode, setResultCode] = useState("");
  const [starting, setStarting] = useState(false);

  const appendUser = useCallback((text: string) => {
    const id = historyId.current++;
    setHistory((previous) => [...previous, { id, role: "user", text }]);
  }, []);

  const appendAssistant = useCallback((text: string) => {
    const id = historyId.current++;
    setHistory((previous) => [...previous, { id, role: "assistant", text }]);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    onBusyChange(true);
    return () => onBusyChange(false);
  }, [onBusyChange]);

  const loadOptions = useCallback(async () => {
    setOptionsBusy(true);
    setOptionsError("");
    try {
      const next = await api.getGtaOptions();
      if (!mounted.current) return;
      setOptions(next);
      setFinalidade((current) =>
        next.finalidades.includes(current)
          ? current
          : next.finalidades.includes(GTA_FINALIDADE_PADRAO)
            ? GTA_FINALIDADE_PADRAO
            : next.finalidades[0] ?? "",
      );
      setTransporte((current) =>
        next.transportes.includes(current)
          ? current
          : next.transportes.includes(GTA_TRANSPORTE_PADRAO)
            ? GTA_TRANSPORTE_PADRAO
            : next.transportes[0] ?? "",
      );
      setDataSaida((current) => current || next.hoje);
      setDataValidade((current) => current || next.validadePadrao);
    } catch (error) {
      if (!mounted.current) return;
      setOptions(null);
      setOptionsError(gtaErrorText(error));
    } finally {
      if (mounted.current) setOptionsBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const lookup = useCallback(
    async (digits: string) => {
      if (!options) return;

      setLookupBusy(true);
      setLookupError("");
      setDestinos([]);

      try {
        const { ueps } = await api.lookupGtaDestinos(
          digits,
          dataSaida || options.hoje,
        );
        if (!mounted.current || cancelled.current) return;

        const filtradas = ueps.filter(
          (uep) =>
            (!uep.uf || uep.uf === options.uf) &&
            !(
              origin &&
              uep.codigoOficial === origin.property.codigo &&
              uep.uep === origin.uep
            ),
        );

        if (filtradas.length === 0) {
          setLookupError(
            "Nenhuma propriedade bovina em Santa Catarina encontrada para este CPF.",
          );
          return;
        }

        setDestinos(filtradas);
        appendAssistant("Qual UEP vai receber os animais?");
        setPhase("uep");
      } catch (error) {
        if (!mounted.current || cancelled.current) return;
        setLookupError(gtaErrorText(error));
      } finally {
        if (mounted.current && !cancelled.current) setLookupBusy(false);
      }
    },
    [options, dataSaida, origin, appendAssistant],
  );

  const submitCpf = useCallback(
    (text: string) => {
      if (phase !== "cpf" || lookupBusy) return;

      const digits = text.replace(/\D/g, "");
      if (!/^\d{11}$|^\d{14}$/.test(digits)) {
        setLookupError("Digite um CPF ou CNPJ válido.");
        return;
      }

      setLookupError("");
      setCpf(digits);
      setDestino(null);
      setDestinos([]);
      appendUser(`CPF ${maskDocumento(digits)}`);
      void lookup(digits);
    },
    [phase, lookupBusy, lookup, appendUser],
  );

  useEffect(() => {
    if (active && phase === "cpf" && !lookupBusy && options) {
      onTextRequest(submitCpf, "CPF ou CNPJ do destino");
      return () => onTextRequest(null);
    }

    onTextRequest(null);
    return undefined;
  }, [active, phase, lookupBusy, options, submitCpf, onTextRequest]);

  useEffect(() => {
    if (!jobId || phase !== "status") return;

    let active = true;
    const tick = async () => {
      try {
        const next = await api.getGta(jobId);
        if (!active) return;
        setJob(next);
        setResultError("");

        if (
          ["emitida", "conferida", "erro", "incerta"].includes(next.status)
        ) {
          setPhase("resultado");
          onBusyChange(false);

          if (
            next.status === "emitida" ||
            next.status === "conferida" ||
            next.status === "incerta"
          ) {
            setCpf("");
            setDestino(null);
          }
        }
      } catch (error) {
        if (active) setResultError(gtaErrorText(error));
      }
    };

    void tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [jobId, phase, onBusyChange]);

  useEffect(() => {
    if (phase === "animais") {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history.length, phase]);

  const saidaValida = Boolean(
    options &&
      dataSaida >= options.hoje &&
      dataSaida <= addDaysIso(options.hoje, GTA_MAX_DIAS_VALIDADE),
  );
  const validadeValida = Boolean(
    dataSaida &&
      dataValidade > dataSaida &&
      dataValidade <= addDaysIso(dataSaida, GTA_MAX_DIAS_VALIDADE),
  );

  function toggleAnimal(unitKey: string, key: string) {
    if (originKey && unitKey !== originKey) return;

    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function groupSelected(unit: GtaOriginUnit): boolean {
    return (
      unit.animals.length > 0 &&
      unit.animals.every((animal) => selected.has(animal.key))
    );
  }

  function toggleGroup(unit: GtaOriginUnit) {
    if (originKey && unit.key !== originKey) return;

    setSelected((previous) => {
      const next = new Set(previous);
      const every = unit.animals.every((animal) => next.has(animal.key));

      for (const animal of unit.animals) {
        if (every) next.delete(animal.key);
        else next.add(animal.key);
      }

      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function continueAnimals() {
    if (!origin || selectedAnimals.length === 0 || !options) return;

    appendUser(
      `${selectedAnimals.length} ${
        selectedAnimals.length === 1 ? "animal" : "animais"
      }: ${animalSelectionSummary(selectedAnimals)} — ${
        origin.property.localidade
      } · UEP ${origin.uep}.`,
    );
    appendAssistant(
      "Para quem vão os animais? Digite o CPF ou CNPJ de quem vai receber.",
    );
    setPhase("cpf");
  }

  function chooseUep(uep: GtaDestinoUep) {
    if (!cpf) return;

    setDestino({ tipo: "terceiro", cpf, uep });
    appendUser(`${uep.localidade} · ${uep.codigoOficial} · UEP ${uep.uep}.`);
    appendAssistant("Qual a finalidade da GTA?");
    setPhase("finalidade");
  }

  function continueFinalidade() {
    if (!finalidade) return;
    appendUser(`Finalidade: ${finalidade}.`);
    appendAssistant("Qual a data da saída?");
    setPhase("dataSaida");
  }

  function continueDataSaida() {
    if (!saidaValida) return;
    appendUser(`Saída: ${formatIsoBr(dataSaida)}.`);
    appendAssistant("Até quando vale a GTA?");

    if (!dataValidade || dataValidade <= dataSaida) {
      setDataValidade(addDaysIso(dataSaida, GTA_VALIDADE_DIAS));
    }
    setPhase("dataValidade");
  }

  function continueDataValidade() {
    if (!validadeValida) return;
    appendUser(`Validade: ${formatIsoBr(dataValidade)}.`);
    appendAssistant("Qual o meio de transporte?");
    setPhase("transporte");
  }

  function continueTransporte() {
    if (!transporte) return;
    appendUser(`Transporte: ${transporte}.`);
    appendAssistant("Qual o número da nota fiscal?");
    setPhase("notaFiscal");
  }

  function askPlaca() {
    appendAssistant("Qual a placa do veículo?");
    setPhase("placa");
  }

  function continueNotaFiscal() {
    const value = notaFiscal.trim();

    if (!value) {
      setNotaFiscal("");
      appendUser("Nota fiscal: em branco.");
      askPlaca();
      return;
    }

    appendUser(`Nota fiscal: ${value}.`);
    askPlaca();
  }

  function continuePlaca() {
    const value = placa.trim().toUpperCase();

    if (!value) {
      setPlaca("");
      appendUser("Placa: em branco.");
      goToReview();
      return;
    }

    setPlaca(value);
    appendUser(`Placa: ${value}.`);
    goToReview();
  }

  function goToReview() {
    appendAssistant("Confira antes de continuar.");
    setConfirmed(false);
    setPhase("revisao");
  }

  function goBack() {
    setConfirmed(false);

    switch (phase) {
      case "cpf":
        appendUser("Voltar.");
        appendAssistant("Quais animais vão na GTA?");
        setPhase("animais");
        setCpf("");
        setDestinos([]);
        setDestino(null);
        setLookupError("");
        setLookupBusy(false);
        break;
      case "uep":
        appendUser("Voltar.");
        appendAssistant(
          "Para quem vão os animais? Digite o CPF ou CNPJ de quem vai receber.",
        );
        setPhase("cpf");
        setCpf("");
        setDestinos([]);
        setDestino(null);
        setLookupError("");
        break;
      case "finalidade":
        appendUser("Voltar.");
        appendAssistant("Qual UEP vai receber os animais?");
        setPhase("uep");
        break;
      case "dataSaida":
        appendUser("Voltar.");
        appendAssistant("Qual a finalidade da GTA?");
        setPhase("finalidade");
        break;
      case "dataValidade":
        appendUser("Voltar.");
        appendAssistant("Qual a data da saída?");
        setPhase("dataSaida");
        break;
      case "transporte":
        appendUser("Voltar.");
        appendAssistant("Até quando vale a GTA?");
        setPhase("dataValidade");
        break;
      case "notaFiscal":
        appendUser("Voltar.");
        appendAssistant("Qual o meio de transporte?");
        setPhase("transporte");
        break;
      case "placa":
        appendUser("Voltar.");
        appendAssistant("Qual o número da nota fiscal?");
        setPhase("notaFiscal");
        break;
      case "revisao":
        appendUser("Voltar.");
        appendAssistant("Qual a placa do veículo?");
        setPhase("placa");
        break;
      default:
        break;
    }
  }

  function cancel() {
    if (!active || phase === "status") return;

    cancelled.current = true;
    appendAssistant("GTA cancelada. Nada foi emitido.");
    setPhase("cancelado");
    setCpf("");
    setDestinos([]);
    setDestino(null);
    setLookupError("");
    setLookupBusy(false);
    setConfirmed(false);
    onTextRequest(null);
    onBusyChange(false);
  }

  async function start(forcar = false) {
    if (
      !active ||
      starting ||
      !origin ||
      !destino ||
      selectedAnimals.length === 0 ||
      !options
    ) {
      return;
    }

    setStarting(true);
    setConfirmed(false);
    setResultError("");
    setResultCode("");
    setJob(null);
    setJobId(null);
    onBusyChange(true);

    const acao = options.emissaoAtiva
      ? forcar
        ? "Emitir outra mesmo assim"
        : "Emitir"
      : "Conferir";
    appendUser(
      `${acao} GTA: ${selectedAnimals.length} ${
        selectedAnimals.length === 1 ? "animal" : "animais"
      }, ${origin.property.localidade} → ${
        destino.uep.localidade
      }, ${finalidade}, ${formatIsoBr(dataSaida)} a ${formatIsoBr(
        dataValidade,
      )}.`,
    );
    setPhase("status");

    try {
      const input = buildGtaInput({
        origem: origin.property,
        origemUep: origin.uep,
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

      const { id } = await api.startGta({
        gta: input,
        modo: options.emissaoAtiva ? "emitir" : "conferir",
        forcar,
      });

      if (!mounted.current) return;
      setJobId(id);
    } catch (error) {
      if (!mounted.current) return;
      const code = error instanceof ApiError ? error.code : "";
      setPhase("resultado");
      setResultError(gtaErrorText(error));
      setResultCode(code);
      if (code === "GTA_INCERTA") {
        setCpf("");
        setDestino(null);
      }
      onBusyChange(false);
    } finally {
      setStarting(false);
    }
  }

  function adjust() {
    if (!active || !origin || !destino) return;
    appendUser("Voltar e ajustar.");
    setPhase("revisao");
    setConfirmed(false);
    appendAssistant("Confira antes de continuar.");
    onBusyChange(true);
  }

  function restart() {
    if (!active) return;
    setCpf("");
    setDestino(null);
    onRestart();
  }

  const cardTitle = (() => {
    switch (phase) {
      case "animais":
        return "Animais";
      case "cpf":
        return "Destino";
      case "uep":
        return "UEP de destino";
      case "finalidade":
        return "Finalidade";
      case "dataSaida":
        return "Data da saída";
      case "dataValidade":
        return "Validade";
      case "transporte":
        return "Transporte";
      case "notaFiscal":
        return "Nota fiscal";
      case "placa":
        return "Placa";
      case "revisao":
        return "Revisão";
      case "status":
        return "Emissão";
      case "resultado":
        return "Resultado";
      case "cancelado":
        return "Cancelada";
    }
  })();

  const resultStatus = job?.status ?? "erro";
  const resultIncertain =
    resultStatus === "incerta" || resultCode === "GTA_INCERTA";
  const resultDone =
    resultStatus === "emitida" || resultStatus === "conferida";
  const canRetry =
    resultStatus === "erro" &&
    !resultIncertain &&
    !["GTA_JA_EMITIDA", "GTA_EM_ANDAMENTO", "GTA_INDISPONIVEL"].includes(
      resultCode,
    );
  const canAdjust =
    resultStatus === "erro" && !resultIncertain && Boolean(origin && destino);

  return (
    <div
      ref={cardRef}
      className="scroll-mt-20 space-y-3"
      data-gta-message
    >
      {history.map((entry) =>
        entry.role === "user" ? (
          <UserBubble key={entry.id}>{entry.text}</UserBubble>
        ) : (
          <AssistantBubble key={entry.id}>{entry.text}</AssistantBubble>
        ),
      )}

      <AssistantShell wide>
        <div className="overflow-hidden rounded-3xl border border-cream-200 bg-cream-50 shadow-sm">
          <div className="flex items-center gap-2 border-b border-cream-200 bg-white/70 px-4 py-3">
            <Truck className="h-4 w-4 shrink-0 text-forest-700" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
              GTA · {cardTitle}
            </p>
          </div>

          <div className="p-4">
            {phase === "animais" && (
              <div>
                {originUnits.length === 0 ? (
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
                          onClick={clearSelection}
                          className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-forest-800 shadow-sm"
                        >
                          Trocar
                        </button>
                      )}
                    </div>

                    <div>
                      {originUnits.map((unit) => {
                        const blocked = Boolean(
                          originKey && unit.key !== originKey,
                        );
                        const every = groupSelected(unit);

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
                                onClick={() => toggleGroup(unit)}
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
                                      checked={selected.has(animal.key)}
                                      onChange={() =>
                                        toggleAnimal(unit.key, animal.key)
                                      }
                                      disabled={blocked}
                                      className="h-5 w-5 shrink-0 accent-forest-700"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate font-extrabold">
                                        {animal.apelido?.trim() ||
                                          "Sem apelido"}
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

                    {optionsBusy && (
                      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-bark-700">
                        <Loader2 className="h-4 w-4 animate-spin text-forest-700" />
                        Carregando opções da GTA...
                      </p>
                    )}

                    {optionsError && (
                      <div className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-800">
                        <p>{optionsError}</p>
                        <button
                          type="button"
                          onClick={() => void loadOptions()}
                          className="mt-2 inline-flex h-9 items-center rounded-full bg-white px-3 text-xs font-bold text-red-800 shadow-sm"
                        >
                          Tentar de novo
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={continueAnimals}
                      disabled={
                        selected.size === 0 || !options || optionsBusy
                      }
                      className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white disabled:opacity-50"
                    >
                      {selected.size === 0
                        ? "Escolha os animais"
                        : `Continuar com ${selected.size}`}
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    <StepLinks onCancel={cancel} />
                  </>
                )}

                {originUnits.length === 0 && (
                  <StepLinks onCancel={cancel} />
                )}
              </div>
            )}

            {phase === "cpf" && (
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

                {lookupBusy && (
                  <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-bark-700">
                    <Loader2 className="h-4 w-4 animate-spin text-forest-700" />
                    Buscando propriedades...
                  </p>
                )}

                {lookupError && (
                  <p
                    className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-800"
                    role="alert"
                  >
                    {lookupError}
                  </p>
                )}

                <StepLinks
                  onBack={goBack}
                  onCancel={cancel}
                  backDisabled={lookupBusy}
                />
              </div>
            )}

            {phase === "uep" && (
              <div>
                {destinos.length > 0 ? (
                  <ul className="max-h-[46dvh] space-y-2 overflow-y-auto overscroll-contain pr-1">
                    {destinos.map((uep) => (
                      <li key={uep.id || `${uep.codigoOficial}-${uep.uep}`}>
                        <button
                          type="button"
                          onClick={() => chooseUep(uep)}
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
                  onBack={goBack}
                  backLabel="Trocar CPF"
                  onCancel={cancel}
                />
              </div>
            )}

            {phase === "finalidade" && (
              <div>
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

                <button
                  type="button"
                  onClick={continueFinalidade}
                  disabled={!finalidade}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white disabled:opacity-50"
                >
                  Continuar
                  <ChevronRight className="h-5 w-5" />
                </button>

                <StepLinks onBack={goBack} onCancel={cancel} />
              </div>
            )}

            {phase === "dataSaida" && (
              <div>
                <label className="block">
                  <span className="text-sm font-bold">Data da saída</span>
                  <input
                    type="date"
                    value={dataSaida}
                    min={options?.hoje}
                    max={
                      options
                        ? addDaysIso(options.hoje, GTA_MAX_DIAS_VALIDADE)
                        : undefined
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      setDataSaida(value);
                      if (
                        value &&
                        (!dataValidade || dataValidade <= value)
                      ) {
                        setDataValidade(
                          addDaysIso(value, GTA_VALIDADE_DIAS),
                        );
                      }
                    }}
                    className="mt-1 w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                  />
                </label>
                <p className="mt-1 text-xs text-bark-500">
                  A validade é calculada a partir desta data.
                </p>

                <button
                  type="button"
                  onClick={continueDataSaida}
                  disabled={!saidaValida}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white disabled:opacity-50"
                >
                  Continuar
                  <ChevronRight className="h-5 w-5" />
                </button>

                <StepLinks onBack={goBack} onCancel={cancel} />
              </div>
            )}

            {phase === "dataValidade" && (
              <div>
                <label className="block">
                  <span className="text-sm font-bold">Validade</span>
                  <input
                    type="date"
                    value={dataValidade}
                    min={dataSaida ? addDaysIso(dataSaida, 1) : undefined}
                    max={
                      dataSaida
                        ? addDaysIso(dataSaida, GTA_MAX_DIAS_VALIDADE)
                        : undefined
                    }
                    onChange={(event) =>
                      setDataValidade(event.target.value)
                    }
                    className="mt-1 w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                  />
                </label>
                <p className="mt-1 text-xs text-bark-500">
                  A validade precisa ser depois da saída.
                </p>

                <button
                  type="button"
                  onClick={continueDataValidade}
                  disabled={!validadeValida}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white disabled:opacity-50"
                >
                  Continuar
                  <ChevronRight className="h-5 w-5" />
                </button>

                <StepLinks onBack={goBack} onCancel={cancel} />
              </div>
            )}

            {phase === "transporte" && (
              <div>
                <label className="block">
                  <span className="text-sm font-bold">Meio de transporte</span>
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

                <button
                  type="button"
                  onClick={continueTransporte}
                  disabled={!transporte}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white disabled:opacity-50"
                >
                  Continuar
                  <ChevronRight className="h-5 w-5" />
                </button>

                <StepLinks onBack={goBack} onCancel={cancel} />
              </div>
            )}

            {phase === "notaFiscal" && (
              <div>
                <label className="block">
                  <span className="text-sm font-bold">Número da nota fiscal</span>
                  <input
                    autoFocus
                    value={notaFiscal}
                    onChange={(event) => setNotaFiscal(event.target.value)}
                    maxLength={30}
                    placeholder="Ex.: 12345"
                    aria-label="Número da nota fiscal"
                    className="mt-1 w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                  />
                </label>
                <p className="mt-1 text-xs text-bark-500">
                  Opcional. Se não tiver nota fiscal, toque em Continuar sem
                  preencher.
                </p>

                <button
                  type="button"
                  onClick={continueNotaFiscal}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white"
                >
                  Continuar
                  <ChevronRight className="h-5 w-5" />
                </button>

                <StepLinks onBack={goBack} onCancel={cancel} />
              </div>
            )}

            {phase === "placa" && (
              <div>
                <label className="block">
                  <span className="text-sm font-bold">Placa do veículo</span>
                  <input
                    autoFocus
                    value={placa}
                    onChange={(event) =>
                      setPlaca(event.target.value.toUpperCase())
                    }
                    maxLength={10}
                    placeholder="Ex.: ABC1D23"
                    aria-label="Placa do veículo"
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="mt-1 w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                  />
                </label>
                <p className="mt-1 text-xs text-bark-500">
                  Opcional. Se não souber a placa, toque em Continuar sem
                  preencher.
                </p>

                <button
                  type="button"
                  onClick={continuePlaca}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white"
                >
                  Continuar
                  <ChevronRight className="h-5 w-5" />
                </button>

                <StepLinks onBack={goBack} onCancel={cancel} />
              </div>
            )}

            {phase === "revisao" && origin && destino && options && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-cream-200 bg-white/80 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
                    Trajeto
                  </p>
                  <p className="mt-1 font-extrabold">
                    {origin.property.localidade}
                  </p>
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
                    {destino.uep.produtor
                      ? ` · ${destino.uep.produtor}`
                      : ""}
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
                    <dd className="font-semibold">{finalidade}</dd>
                    <dt className="text-bark-500">Saída</dt>
                    <dd className="font-semibold">
                      {formatIsoBr(dataSaida)}
                    </dd>
                    <dt className="text-bark-500">Validade</dt>
                    <dd className="font-semibold">
                      {formatIsoBr(dataValidade)}
                    </dd>
                    <dt className="text-bark-500">Transporte</dt>
                    <dd className="font-semibold">{transporte}</dd>
                    <dt className="text-bark-500">Nota fiscal</dt>
                    <dd className="font-semibold">
                      {notaFiscal.trim() || "Em branco"}
                    </dd>
                    <dt className="text-bark-500">Placa</dt>
                    <dd className="font-semibold">
                      {placa.trim() ? placa.toUpperCase() : "Em branco"}
                    </dd>
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

                <details className="rounded-2xl border border-cream-200 bg-white/70 p-3">
                  <summary className="cursor-pointer text-sm font-bold">
                    Lacre e observação (opcional)
                  </summary>
                  <div className="mt-3 space-y-2">
                    <input
                      value={lacre}
                      onChange={(event) => {
                        setLacre(event.target.value);
                        setConfirmed(false);
                      }}
                      maxLength={30}
                      placeholder="Lacre"
                      aria-label="Lacre"
                      className="w-full rounded-2xl border border-cream-200 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-700/40"
                    />
                    <textarea
                      value={observacao}
                      onChange={(event) => {
                        setObservacao(event.target.value);
                        setConfirmed(false);
                      }}
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
                      checked={confirmed}
                      onChange={(event) =>
                        setConfirmed(event.target.checked)
                      }
                      className="mt-0.5 h-5 w-5 shrink-0 accent-forest-700"
                    />
                    Entendi que a GTA é um documento oficial e não pode ser
                    desfeita pelo app.
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => void start(false)}
                  disabled={
                    starting || (options.emissaoAtiva && !confirmed)
                  }
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

                <StepLinks onBack={goBack} onCancel={cancel} />
              </div>
            )}

            {phase === "status" && (
              <div className="flex flex-col items-center py-4 text-center">
                <Loader2 className="h-9 w-9 animate-spin text-forest-700" />
                <p className="mt-3 text-lg font-extrabold">
                  {gtaStageText(job)}
                </p>

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

                {resultError && (
                  <p className="mt-3 max-w-xs text-xs text-amber-800">
                    {resultError}
                  </p>
                )}
              </div>
            )}

            {phase === "resultado" && (
              <div className="flex flex-col items-center py-2 text-center">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${
                    resultDone
                      ? "bg-emerald-100 text-emerald-700"
                      : resultIncertain
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {resultDone ? (
                    <CheckCircle2 className="h-7 w-7" />
                  ) : (
                    <AlertTriangle className="h-7 w-7" />
                  )}
                </div>

                <h3 className="mt-2 text-xl font-black">
                  {resultStatus === "emitida"
                    ? "GTA emitida"
                    : resultStatus === "conferida"
                      ? "Conferência concluída"
                      : resultIncertain
                        ? "Confira no SIGEN"
                        : "Não foi possível emitir"}
                </h3>

                <p className="mt-2 max-w-sm text-sm text-bark-500">
                  {resultStatus === "emitida"
                    ? "A GTA foi registrada no SIGEN."
                    : resultStatus === "conferida"
                      ? "Nada foi emitido. O SIGEN aceitou os dados desta GTA."
                      : resultIncertain
                        ? "A GTA pode ter sido emitida. Confira no SIGEN antes de tentar de novo."
                        : job?.erro ?? resultError ?? "Tente de novo."}
                </p>

                {resultStatus === "emitida" && job?.numero && (
                  <p className="mt-3 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-lg font-black">
                    Nº {job.numero}
                  </p>
                )}

                {resultStatus === "emitida" && !job?.numero && (
                  <p className="mt-2 text-xs text-bark-500">
                    O SIGEN não devolveu o número. Confira no próprio SIGEN.
                  </p>
                )}

                {resultStatus === "emitida" && job?.temPdf && (
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

                {resultStatus === "emitida" && !job?.temPdf && (
                  <p className="mt-2 text-xs text-bark-500">
                    O PDF não está disponível. Imprima pelo SIGEN.
                  </p>
                )}

                {active && (
                  <div className="mt-4 flex w-full flex-col gap-2">
                    {resultDone && (
                    <button
                      type="button"
                      onClick={restart}
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-forest-700 px-4 text-sm font-extrabold text-white"
                    >
                      {options?.emissaoAtiva
                        ? "Fazer outra GTA"
                        : "Conferir outra"}
                    </button>
                  )}

                  {canRetry && (
                    <button
                      type="button"
                      onClick={() => void start(false)}
                      disabled={starting}
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-forest-700 px-4 text-sm font-extrabold text-white disabled:opacity-50"
                    >
                      Tentar de novo
                    </button>
                  )}

                  {resultCode === "GTA_JA_EMITIDA" &&
                    options?.emissaoAtiva && (
                      <button
                        type="button"
                        onClick={() => void start(true)}
                        disabled={starting}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-900 disabled:opacity-50"
                      >
                        Emitir outra mesmo assim
                      </button>
                    )}

                  {canAdjust && (
                    <button
                      type="button"
                      onClick={adjust}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-cream-200 bg-white px-4 text-sm font-bold text-bark-500"
                    >
                      Voltar e ajustar
                    </button>
                  )}

                  {resultStatus === "erro" && !resultIncertain && (
                    <button
                      type="button"
                      onClick={restart}
                      className="inline-flex h-10 items-center justify-center rounded-2xl text-sm font-bold text-bark-500 transition hover:bg-cream-200"
                    >
                      Fazer outra GTA
                    </button>
                  )}
                  </div>
                )}
              </div>
            )}

            {phase === "cancelado" && (
              <div className="py-2 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cream-200 text-bark-500">
                  <X className="h-7 w-7" />
                </div>
                <h3 className="mt-2 text-xl font-black">GTA cancelada</h3>
                <p className="mt-2 text-sm text-bark-500">
                  Nada foi emitido.
                </p>
                {active && (
                  <button
                    type="button"
                    onClick={restart}
                    className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-forest-700 px-4 text-sm font-extrabold text-white"
                  >
                    Começar de novo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </AssistantShell>

      <div ref={bottomRef} />
    </div>
  );
}
