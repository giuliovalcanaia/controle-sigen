import {
  addDaysIso,
  animalSelectionSummary,
  buildOriginUnits,
  formatIsoBr,
  GTA_FINALIDADE_PADRAO,
  GTA_MAX_DIAS_VALIDADE,
  GTA_TRANSPORTE_PADRAO,
  GTA_VALIDADE_DIAS,
  maskDocumento,
  originKeyForSelection,
  type GtaOriginUnit,
} from "./gta";
import type {
  Animal,
  GtaConferenciaResultado,
  GtaDestinoUep,
  GtaJobView,
  GtaOptions,
  GtaStatus,
  Inventory,
} from "./types";

/** Uma conversa de GTA tem uma fase, e só uma, por vez. */
export type GtaPhase =
  | "animais"
  | "cpf"
  | "uep"
  | "datas"
  | "extras"
  | "notaFiscal"
  | "placa"
  | "revisao"
  | "status"
  | "resultado"
  | "cancelado";

export type GtaHistoryEntry = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

export type DestinoTerceiro = {
  tipo: "terceiro";
  cpf: string;
  uep: GtaDestinoUep;
};

export type GtaEditingField =
  | "finalidade"
  | "saida"
  | "validade"
  | "transporte"
  | null;

export type GtaFlowState = {
  inventory: Inventory;
  phase: GtaPhase;
  history: GtaHistoryEntry[];
  nextHistoryId: number;
  options: GtaOptions | null;
  optionsBusy: boolean;
  optionsError: string;
  selected: Set<string>;
  cpf: string;
  lookupBusy: boolean;
  lookupError: string;
  destinos: GtaDestinoUep[];
  destino: DestinoTerceiro | null;
  finalidade: string;
  dataSaida: string;
  dataValidade: string;
  transporte: string;
  editingField: GtaEditingField;
  notaFiscal: string;
  placa: string;
  lacre: string;
  observacao: string;
  confirmed: boolean;
  jobId: number | null;
  job: GtaJobView | null;
  resultError: string;
  resultCode: string;
  starting: boolean;
  resolving: boolean;
  resolveError: string;
};

export type GtaFlowEvent =
  | { type: "selecionarAnimal"; unitKey: string; key: string }
  | { type: "alternarGrupo"; unitKey: string }
  | { type: "limparSelecao" }
  | { type: "continuarAnimais" }
  | { type: "cpfInvalido"; mensagem: string }
  | { type: "buscarCpf"; cpf: string }
  | { type: "destinosEncontrados"; cpf: string; ueps: GtaDestinoUep[] }
  | { type: "destinosFalharam"; cpf: string; mensagem: string }
  | { type: "escolherUep"; uep: GtaDestinoUep }
  | { type: "voltar" }
  | { type: "alternarCampo"; campo: Exclude<GtaEditingField, null> }
  | { type: "mudarFinalidade"; valor: string }
  | { type: "mudarSaida"; valor: string }
  | { type: "mudarValidade"; valor: string }
  | { type: "mudarTransporte"; valor: string }
  | { type: "continuarDatas" }
  | { type: "responderExtras"; informar: boolean }
  | { type: "mudarNotaFiscal"; valor: string }
  | { type: "continuarNotaFiscal" }
  | { type: "mudarPlaca"; valor: string }
  | { type: "continuarPlaca" }
  | { type: "mudarLacre"; valor: string }
  | { type: "mudarObservacao"; valor: string }
  | { type: "confirmar"; valor: boolean }
  | { type: "iniciar" }
  | { type: "inicioAceito"; id: number }
  | { type: "inicioFalhou"; mensagem: string; codigo: string }
  | { type: "jobRecebido"; job: GtaJobView }
  | { type: "consultaFalhou"; mensagem: string }
  | { type: "resolucaoIniciada" }
  | { type: "jobResolvido"; job: GtaJobView }
  | { type: "resolucaoFalhou"; mensagem: string }
  | { type: "ajustar" }
  | { type: "cancelar" }
  | { type: "reiniciar" }
  | { type: "opcoesCarregando" }
  | { type: "opcoesCarregadas"; options: GtaOptions }
  | { type: "opcoesFalharam"; mensagem: string };

export type GtaActions = {
  selecionarAnimal(unitKey: string, key: string): void;
  alternarGrupo(unitKey: string): void;
  limparSelecao(): void;
  continuarAnimais(): void;
  escolherUep(uep: GtaDestinoUep): void;
  voltar(): void;
  alternarCampo(campo: Exclude<GtaEditingField, null>): void;
  mudarFinalidade(valor: string): void;
  mudarSaida(valor: string): void;
  mudarValidade(valor: string): void;
  mudarTransporte(valor: string): void;
  continuarDatas(): void;
  responderExtras(informar: boolean): void;
  mudarNotaFiscal(valor: string): void;
  continuarNotaFiscal(): void;
  mudarPlaca(valor: string): void;
  continuarPlaca(): void;
  mudarLacre(valor: string): void;
  mudarObservacao(valor: string): void;
  confirmar(valor: boolean): void;
  iniciar(): void;
  resolver(resultado: GtaConferenciaResultado): void;
  ajustar(): void;
  cancelar(): void;
  reiniciar(): void;
  recarregarOpcoes(): void;
};

export function initialGtaFlowState(inventory: Inventory): GtaFlowState {
  return {
    inventory,
    phase: "animais",
    history: [
      {
        id: 1,
        role: "assistant",
        text: "Vamos fazer a GTA. Quais animais vão sair?",
      },
    ],
    nextHistoryId: 2,
    options: null,
    optionsBusy: true,
    optionsError: "",
    selected: new Set(),
    cpf: "",
    lookupBusy: false,
    lookupError: "",
    destinos: [],
    destino: null,
    finalidade: GTA_FINALIDADE_PADRAO,
    dataSaida: "",
    dataValidade: "",
    transporte: GTA_TRANSPORTE_PADRAO,
    editingField: null,
    notaFiscal: "",
    placa: "",
    lacre: "",
    observacao: "",
    confirmed: false,
    jobId: null,
    job: null,
    resultError: "",
    resultCode: "",
    starting: false,
    resolving: false,
    resolveError: "",
  };
}

const user = (text: string) => ({ role: "user" as const, text });
const assistant = (text: string) => ({ role: "assistant" as const, text });

function comHistorico(
  state: GtaFlowState,
  ...entradas: Array<Omit<GtaHistoryEntry, "id">>
): Pick<GtaFlowState, "history" | "nextHistoryId"> {
  let id = state.nextHistoryId;
  const history = [
    ...state.history,
    ...entradas.map((entrada) => ({ ...entrada, id: id++ })),
  ];
  return { history, nextHistoryId: id };
}

export function unidadesDaGta(state: GtaFlowState): GtaOriginUnit[] {
  return buildOriginUnits(state.inventory);
}

export function origemDaGta(
  state: GtaFlowState,
  units = unidadesDaGta(state),
): GtaOriginUnit | null {
  const key = originKeyForSelection(units, state.selected);
  return units.find((unit) => unit.key === key) ?? null;
}

export function animaisSelecionados(
  state: GtaFlowState,
  units = unidadesDaGta(state),
): Animal[] {
  return units
    .flatMap((unit) => unit.animals)
    .filter((animal) => state.selected.has(animal.key));
}

export function saidaValida(state: GtaFlowState): boolean {
  return Boolean(
    state.options &&
      state.dataSaida >= state.options.hoje &&
      state.dataSaida <= addDaysIso(state.options.hoje, GTA_MAX_DIAS_VALIDADE),
  );
}

export function validadeValida(state: GtaFlowState): boolean {
  return Boolean(
    state.dataSaida &&
      state.dataValidade > state.dataSaida &&
      state.dataValidade <=
        addDaysIso(state.dataSaida, GTA_MAX_DIAS_VALIDADE),
  );
}

export function podeIniciar(state: GtaFlowState): boolean {
  if (state.phase !== "revisao" && state.phase !== "resultado") return false;
  const units = unidadesDaGta(state);
  return Boolean(
    origemDaGta(state, units) &&
      state.destino &&
      animaisSelecionados(state, units).length > 0 &&
      state.options,
  );
}

export function filtrarDestinos(
  ueps: GtaDestinoUep[],
  state: GtaFlowState,
): GtaDestinoUep[] {
  const origin = origemDaGta(state);
  return ueps.filter(
    (uep) =>
      (!uep.uf || uep.uf === state.options?.uf) &&
      !(
        origin &&
        uep.codigoOficial === origin.property.codigo &&
        uep.uep === origin.uep
      ),
  );
}

/** Valida o CPF/CNPJ digitado no campo de mensagem. */
export function parseDocumento(
  text: string,
): { ok: true; digits: string } | { ok: false } {
  const digits = text.replace(/\D/g, "");
  return /^\d{11}$|^\d{14}$/.test(digits)
    ? { ok: true, digits }
    : { ok: false };
}

export function tituloDoCartao(phase: GtaPhase): string {
  switch (phase) {
    case "animais":
      return "Animais";
    case "cpf":
      return "Destino";
    case "uep":
      return "UEP de destino";
    case "datas":
      return "Finalidade e datas";
    case "extras":
      return "Nota fiscal e placa";
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
}

export type GtaResultado = {
  status: GtaStatus;
  incerta: boolean;
  concluida: boolean;
  naoEmitida: boolean;
  podeTentarDeNovo: boolean;
};

const RETENTATIVAS_BLOQUEADAS = [
  "GTA_JA_EMITIDA",
  "GTA_ANIMAL_JA_SAIU",
  "GTA_EM_ANDAMENTO",
  "GTA_INDISPONIVEL",
  "GTA_UEP_INVALIDA",
  "GTA_ANIMAL_NAO_ENCONTRADO",
  "GTA_ANIMAIS_DIVERGENTES",
  "GTA_TELA_MUDOU",
  "GTA_CPF_ORIGEM",
];

export function resultadoDaGta(state: GtaFlowState): GtaResultado {
  const status = state.job?.status ?? "erro";
  const codigo = state.resultCode || state.job?.codigo || "";
  const incerta = status === "incerta" || codigo === "GTA_INCERTA";
  return {
    status,
    incerta,
    concluida: status === "emitida" || status === "conferida",
    naoEmitida: status === "nao_emitida",
    podeTentarDeNovo:
      (status === "erro" || status === "nao_emitida") &&
      !incerta &&
      !RETENTATIVAS_BLOQUEADAS.includes(codigo),
  };
}

function statusTerminal(status: GtaStatus): boolean {
  return ["emitida", "conferida", "nao_emitida", "erro", "incerta"].includes(
    status,
  );
}

export function gtaFlowReducer(
  state: GtaFlowState,
  action: GtaFlowEvent,
): GtaFlowState {
  // Depois de cancelar, só uma nova conversa interessa.
  if (state.phase === "cancelado" && action.type !== "reiniciar") {
    return state;
  }

  switch (action.type) {
    case "selecionarAnimal": {
      if (state.phase !== "animais") return state;
      const units = unidadesDaGta(state);
      const originKey = originKeyForSelection(units, state.selected);
      if (originKey && action.unitKey !== originKey) return state;

      const selected = new Set(state.selected);
      if (selected.has(action.key)) selected.delete(action.key);
      else selected.add(action.key);
      return { ...state, selected };
    }

    case "alternarGrupo": {
      if (state.phase !== "animais") return state;
      const units = unidadesDaGta(state);
      const originKey = originKeyForSelection(units, state.selected);
      if (originKey && action.unitKey !== originKey) return state;

      const unit = units.find((item) => item.key === action.unitKey);
      if (!unit) return state;

      const selected = new Set(state.selected);
      const todos = unit.animals.every((animal) => selected.has(animal.key));
      for (const animal of unit.animals) {
        if (todos) selected.delete(animal.key);
        else selected.add(animal.key);
      }
      return { ...state, selected };
    }

    case "limparSelecao":
      return state.phase === "animais" ? { ...state, selected: new Set() } : state;

    case "continuarAnimais": {
      if (state.phase !== "animais") return state;
      const units = unidadesDaGta(state);
      const origin = origemDaGta(state, units);
      const animais = animaisSelecionados(state, units);
      if (!origin || animais.length === 0 || !state.options) return state;

      const resumo = `${animais.length} ${
        animais.length === 1 ? "animal" : "animais"
      }: ${animalSelectionSummary(animais)} — ${origin.property.localidade} · UEP ${origin.uep}.`;

      return {
        ...state,
        phase: "cpf",
        ...comHistorico(
          state,
          user(resumo),
          assistant(
            "Para quem vão os animais? Digite o CPF ou CNPJ de quem vai receber.",
          ),
        ),
      };
    }

    case "cpfInvalido":
      return state.phase === "cpf"
        ? { ...state, lookupError: action.mensagem }
        : state;

    case "buscarCpf": {
      if (state.phase !== "cpf") return state;
      return {
        ...state,
        cpf: action.cpf,
        lookupBusy: true,
        lookupError: "",
        destinos: [],
        destino: null,
        ...comHistorico(state, user(`CPF ${maskDocumento(action.cpf)}`)),
      };
    }

    case "destinosEncontrados": {
      if (state.phase !== "cpf" || state.cpf !== action.cpf) return state;
      const ueps = filtrarDestinos(action.ueps, state);
      if (ueps.length === 0) {
        return {
          ...state,
          lookupBusy: false,
          destinos: [],
          lookupError:
            "Nenhuma propriedade bovina em Santa Catarina encontrada para este CPF.",
        };
      }
      return {
        ...state,
        lookupBusy: false,
        lookupError: "",
        destinos: ueps,
        phase: "uep",
        ...comHistorico(
          state,
          assistant("Qual UEP vai receber os animais?"),
        ),
      };
    }

    case "destinosFalharam":
      return state.phase === "cpf" && state.cpf === action.cpf
        ? { ...state, lookupBusy: false, lookupError: action.mensagem }
        : state;

    case "escolherUep": {
      if (state.phase !== "uep" || !state.cpf) return state;
      const { uep } = action;
      return {
        ...state,
        destino: { tipo: "terceiro", cpf: state.cpf, uep },
        phase: "datas",
        editingField: null,
        ...comHistorico(
          state,
          user(`${uep.localidade} · ${uep.codigoOficial} · UEP ${uep.uep}.`),
          assistant("Confira os dados da GTA."),
        ),
      };
    }

    case "voltar": {
      if (state.phase === "status") return state;
      const base = { ...state, confirmed: false };

      switch (state.phase) {
        case "cpf":
          return {
            ...base,
            phase: "animais",
            cpf: "",
            destinos: [],
            destino: null,
            lookupError: "",
            lookupBusy: false,
            ...comHistorico(
              state,
              user("Voltar."),
              assistant("Quais animais vão na GTA?"),
            ),
          };
        case "uep":
          return {
            ...base,
            phase: "cpf",
            cpf: "",
            destinos: [],
            destino: null,
            lookupError: "",
            ...comHistorico(
              state,
              user("Voltar."),
              assistant(
                "Para quem vão os animais? Digite o CPF ou CNPJ de quem vai receber.",
              ),
            ),
          };
        case "datas":
          return {
            ...base,
            phase: "uep",
            editingField: null,
            ...comHistorico(
              state,
              user("Voltar."),
              assistant("Qual UEP vai receber os animais?"),
            ),
          };
        case "extras":
          return {
            ...base,
            phase: "datas",
            editingField: null,
            ...comHistorico(state, user("Voltar.")),
          };
        case "notaFiscal":
          return {
            ...base,
            phase: "extras",
            ...comHistorico(state, user("Voltar.")),
          };
        case "placa":
          return {
            ...base,
            phase: "notaFiscal",
            ...comHistorico(
              state,
              user("Voltar."),
              assistant("Qual o número da nota fiscal?"),
            ),
          };
        case "revisao":
          return {
            ...base,
            phase: "extras",
            ...comHistorico(state, user("Voltar.")),
          };
        default:
          return state;
      }
    }

    case "alternarCampo":
      return {
        ...state,
        editingField:
          state.editingField === action.campo ? null : action.campo,
      };

    case "mudarFinalidade":
      return state.phase === "datas"
        ? { ...state, finalidade: action.valor }
        : state;

    case "mudarTransporte":
      return state.phase === "datas"
        ? { ...state, transporte: action.valor }
        : state;

    case "mudarValidade":
      return state.phase === "datas"
        ? { ...state, dataValidade: action.valor }
        : state;

    case "mudarSaida": {
      if (state.phase !== "datas") return state;
      const valor = action.valor;
      const validade =
        valor &&
        (!state.dataValidade ||
          state.dataValidade <= valor ||
          state.dataValidade >
            addDaysIso(valor, GTA_MAX_DIAS_VALIDADE))
          ? addDaysIso(valor, GTA_VALIDADE_DIAS)
          : state.dataValidade;
      return { ...state, dataSaida: valor, dataValidade: validade };
    }

    case "continuarDatas": {
      if (
        state.phase !== "datas" ||
        !state.finalidade ||
        !state.transporte ||
        !saidaValida(state) ||
        !validadeValida(state)
      ) {
        return state;
      }
      return {
        ...state,
        phase: "extras",
        ...comHistorico(
          state,
          user(
            `Finalidade: ${state.finalidade} · Saída: ${formatIsoBr(
              state.dataSaida,
            )} · Validade: ${formatIsoBr(
              state.dataValidade,
            )} · Transporte: ${state.transporte}.`,
          ),
        ),
      };
    }

    case "responderExtras": {
      if (state.phase !== "extras") return state;
      if (!action.informar) {
        return {
          ...state,
          notaFiscal: "",
          placa: "",
          phase: "revisao",
          confirmed: false,
          ...comHistorico(
            state,
            user("Não."),
            assistant("Confira antes de continuar."),
          ),
        };
      }
      return {
        ...state,
        phase: "notaFiscal",
        ...comHistorico(
          state,
          user("Sim."),
          assistant("Qual o número da nota fiscal?"),
        ),
      };
    }

    case "mudarNotaFiscal":
      return state.phase === "notaFiscal"
        ? { ...state, notaFiscal: action.valor }
        : state;

    case "continuarNotaFiscal": {
      if (state.phase !== "notaFiscal") return state;
      const value = state.notaFiscal.trim();
      return {
        ...state,
        notaFiscal: value,
        phase: "placa",
        ...comHistorico(
          state,
          user(value ? `Nota fiscal: ${value}.` : "Nota fiscal: em branco."),
          assistant("Qual a placa do veículo?"),
        ),
      };
    }

    case "mudarPlaca":
      return state.phase === "placa"
        ? { ...state, placa: action.valor.toUpperCase() }
        : state;

    case "continuarPlaca": {
      if (state.phase !== "placa") return state;
      const value = state.placa.trim().toUpperCase();
      return {
        ...state,
        placa: value,
        phase: "revisao",
        confirmed: false,
        ...comHistorico(
          state,
          user(value ? `Placa: ${value}.` : "Placa: em branco."),
          assistant("Confira antes de continuar."),
        ),
      };
    }

    case "mudarLacre":
      return { ...state, lacre: action.valor, confirmed: false };

    case "mudarObservacao":
      return { ...state, observacao: action.valor, confirmed: false };

    case "confirmar":
      return { ...state, confirmed: action.valor };

    case "iniciar": {
      if (state.phase !== "revisao" && state.phase !== "resultado") {
        return state;
      }
      const units = unidadesDaGta(state);
      const origin = origemDaGta(state, units);
      const animais = animaisSelecionados(state, units);
      if (!origin || !state.destino || animais.length === 0 || !state.options) {
        return state;
      }

      const acao = state.options.emissaoAtiva ? "Emitir" : "Conferir";
      return {
        ...state,
        phase: "status",
        starting: true,
        confirmed: false,
        resultError: "",
        resultCode: "",
        resolveError: "",
        job: null,
        jobId: null,
        ...comHistorico(
          state,
          user(
            `${acao} GTA: ${animais.length} ${
              animais.length === 1 ? "animal" : "animais"
            }, ${origin.property.localidade} → ${
              state.destino.uep.localidade
            }, ${state.finalidade}, ${formatIsoBr(
              state.dataSaida,
            )} a ${formatIsoBr(state.dataValidade)}.`,
          ),
        ),
      };
    }

    case "inicioAceito":
      return { ...state, starting: false, jobId: action.id };

    case "inicioFalhou":
      return {
        ...state,
        phase: "resultado",
        starting: false,
        resultError: action.mensagem,
        resultCode: action.codigo,
      };

    case "jobRecebido": {
      const next: GtaFlowState = {
        ...state,
        job: action.job,
        resultError: "",
      };
      if (!statusTerminal(action.job.status)) return next;

      next.phase = "resultado";
      if (
        action.job.status === "emitida" ||
        action.job.status === "conferida"
      ) {
        next.cpf = "";
        next.destino = null;
      }
      return next;
    }

    case "consultaFalhou":
      return state.phase === "status"
        ? { ...state, resultError: action.mensagem }
        : state;

    case "resolucaoIniciada":
      return { ...state, resolving: true, resolveError: "" };

    case "jobResolvido": {
      const next: GtaFlowState = {
        ...state,
        job: action.job,
        resolving: false,
        resolveError: "",
        resultError: "",
        resultCode: "",
      };
      if (action.job.status === "emitida") {
        next.cpf = "";
        next.destino = null;
      }
      return next;
    }

    case "resolucaoFalhou":
      return { ...state, resolving: false, resolveError: action.mensagem };

    case "ajustar": {
      if (state.phase !== "resultado") return state;
      const origin = origemDaGta(state);
      if (!origin || !state.destino) return state;
      return {
        ...state,
        phase: "revisao",
        confirmed: false,
        ...comHistorico(
          state,
          user("Voltar e ajustar."),
          assistant("Confira antes de continuar."),
        ),
      };
    }

    case "cancelar": {
      if (state.phase === "status") return state;
      return {
        ...state,
        phase: "cancelado",
        cpf: "",
        destinos: [],
        destino: null,
        lookupError: "",
        lookupBusy: false,
        confirmed: false,
        ...comHistorico(
          state,
          assistant("GTA cancelada. Nada foi emitido."),
        ),
      };
    }

    case "reiniciar":
      return { ...state, cpf: "", destino: null };

    case "opcoesCarregando":
      return { ...state, optionsBusy: true, optionsError: "" };

    case "opcoesCarregadas": {
      const { options } = action;
      const finalidade = options.finalidades.includes(state.finalidade)
        ? state.finalidade
        : options.finalidades.includes(GTA_FINALIDADE_PADRAO)
          ? GTA_FINALIDADE_PADRAO
          : options.finalidades[0] ?? "";
      const transporte = options.transportes.includes(state.transporte)
        ? state.transporte
        : options.transportes.includes(GTA_TRANSPORTE_PADRAO)
          ? GTA_TRANSPORTE_PADRAO
          : options.transportes[0] ?? "";
      return {
        ...state,
        options,
        optionsBusy: false,
        optionsError: "",
        finalidade,
        transporte,
        dataSaida: state.dataSaida || options.hoje,
        dataValidade: state.dataValidade || options.validadePadrao,
      };
    }

    case "opcoesFalharam":
      return {
        ...state,
        options: null,
        optionsBusy: false,
        optionsError: action.mensagem,
      };
  }
}
