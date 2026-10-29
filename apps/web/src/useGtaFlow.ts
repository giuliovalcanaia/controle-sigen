import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { ApiError, api } from "./api";
import { buildGtaInput } from "./gta";
import {
  animaisSelecionados,
  gtaFlowReducer,
  initialGtaFlowState,
  origemDaGta,
  parseDocumento,
  podeIniciar,
  unidadesDaGta,
  type GtaActions,
  type GtaFlowState,
} from "./gtaFlow";
import type { GtaConferenciaResultado, Inventory } from "./types";

/** Mensagem amigável para um erro da API, com os casos da GTA. */
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

type Params = {
  inventory: Inventory;
  flowId: number;
  active: boolean;
  onBusyChange: (flowId: number, busy: boolean) => void;
  onTextRequest: (
    flowId: number,
    handler: ((text: string) => void) | null,
    prompt?: string,
  ) => void;
  onRestart: () => void;
};

/**
 * Dono do fluxo de uma conversa de GTA.
 *
 * As regras (fases, voltar, validação, narrativa) ficam no reducer puro de
 * `gtaFlow.ts`; este hook faz as chamadas à API e registra os canais com o
 * App — sempre identificados pelo `flowId`, para uma conversa antiga não
 * mexer no "ocupado" nem no campo de texto da conversa nova.
 */
export function useGtaFlow({
  inventory,
  flowId,
  active,
  onBusyChange,
  onTextRequest,
  onRestart,
}: Params) {
  const [state, dispatch] = useReducer(
    gtaFlowReducer,
    inventory,
    initialGtaFlowState,
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const mounted = useRef(true);
  const startingRef = useRef(false);
  const resolvingRef = useRef(false);
  const lookupRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const units = useMemo(
    () => unidadesDaGta(state),
    [state.inventory],
  );
  const selectedAnimals = useMemo(
    () => animaisSelecionados(state, units),
    [state.selected, units],
  );
  const origin = useMemo(() => origemDaGta(state, units), [state.selected, units]);
  const originKey = origin?.key ?? null;

  // Ocupado = a conversa ainda está no meio do caminho. Depois do resultado
  // (ou do cancelamento), o rodapé volta a ficar livre.
  const busy = state.phase !== "resultado" && state.phase !== "cancelado";

  useEffect(() => {
    onBusyChange(flowId, busy);
  }, [busy, flowId, onBusyChange]);

  useEffect(
    () => () => {
      onBusyChange(flowId, false);
    },
    [flowId, onBusyChange],
  );

  const loadOptions = useCallback(async () => {
    dispatch({ type: "opcoesCarregando" });
    try {
      const options = await api.getGtaOptions();
      if (mounted.current) dispatch({ type: "opcoesCarregadas", options });
    } catch (error) {
      if (mounted.current) {
        dispatch({ type: "opcoesFalharam", mensagem: gtaErrorText(error) });
      }
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const lookup = useCallback(
    async (digits: string, snapshot: GtaFlowState) => {
      const dataSaida = snapshot.dataSaida || snapshot.options?.hoje || "";
      try {
        const { ueps } = await api.lookupGtaDestinos(digits, dataSaida);
        if (mounted.current) {
          dispatch({ type: "destinosEncontrados", cpf: digits, ueps });
        }
      } catch (error) {
        if (mounted.current) {
          dispatch({
            type: "destinosFalharam",
            cpf: digits,
            mensagem: gtaErrorText(error),
          });
        }
      }
    },
    [],
  );

  // Precisa ser estável: o App guarda este handler até a fase mudar.
  const informarCpf = useCallback(
    (text: string) => {
      const snapshot = stateRef.current;
      if (
        !active ||
        lookupRef.current ||
        snapshot.phase !== "cpf" ||
        snapshot.lookupBusy ||
        !snapshot.options
      ) {
        return;
      }

      const documento = parseDocumento(text);
      if (!documento.ok) {
        dispatch({
          type: "cpfInvalido",
          mensagem: "Digite um CPF ou CNPJ válido.",
        });
        return;
      }

      lookupRef.current = true;
      dispatch({ type: "buscarCpf", cpf: documento.digits });
      void lookup(documento.digits, snapshot).finally(() => {
        lookupRef.current = false;
      });
    },
    [active, lookup],
  );

  useEffect(() => {
    if (
      !active ||
      state.phase !== "cpf" ||
      state.lookupBusy ||
      !state.options
    ) {
      return;
    }

    onTextRequest(flowId, informarCpf, "CPF ou CNPJ do destino");
    return () => onTextRequest(flowId, null);
  }, [
    active,
    state.phase,
    state.lookupBusy,
    state.options,
    flowId,
    informarCpf,
    onTextRequest,
  ]);

  useEffect(() => {
    if (!state.jobId || state.phase !== "status") return;

    const id = state.jobId;
    let alive = true;

    const tick = async () => {
      try {
        const job = await api.getGta(id);
        if (alive && mounted.current) dispatch({ type: "jobRecebido", job });
      } catch (error) {
        if (alive && mounted.current) {
          dispatch({
            type: "consultaFalhou",
            mensagem: gtaErrorText(error),
          });
        }
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [state.jobId, state.phase]);

  const iniciar = useCallback(() => {
    const snapshot = stateRef.current;
    if (
      !active ||
      snapshot.starting ||
      startingRef.current ||
      !podeIniciar(snapshot)
    ) {
      return;
    }

    const snapshotUnits = unidadesDaGta(snapshot);
    const unit = origemDaGta(snapshot, snapshotUnits);
    const animais = animaisSelecionados(snapshot, snapshotUnits);
    if (!unit || !snapshot.destino || animais.length === 0 || !snapshot.options) {
      return;
    }

    const input = buildGtaInput({
      origem: unit.property,
      origemUep: unit.uep,
      destino: snapshot.destino,
      animais,
      finalidade: snapshot.finalidade,
      dataSaida: snapshot.dataSaida,
      dataValidade: snapshot.dataValidade,
      transporte: snapshot.transporte,
      notaFiscal: snapshot.notaFiscal,
      placa: snapshot.placa,
      lacre: snapshot.lacre,
      observacao: snapshot.observacao,
    });
    const modo = snapshot.options.emissaoAtiva ? "emitir" : "conferir";

    startingRef.current = true;
    dispatch({ type: "iniciar" });

    void (async () => {
      try {
        const { id } = await api.startGta({ gta: input, modo });
        if (mounted.current) dispatch({ type: "inicioAceito", id });
      } catch (error) {
        if (!mounted.current) return;

        const codigo = error instanceof ApiError ? error.code : "";
        dispatch({
          type: "inicioFalhou",
          mensagem: gtaErrorText(error),
          codigo,
        });

        // A incerta pode ter sido criada numa sessão anterior (o chat some
        // ao recarregar). Carrega o registro que bloqueou para conferir.
        const incertaId =
          error instanceof ApiError ? error.detalhe?.gtaId : undefined;
        if (codigo === "GTA_INCERTA" && incertaId) {
          try {
            const previous = await api.getGta(incertaId);
            if (mounted.current) {
              dispatch({ type: "jobRecebido", job: previous });
            }
          } catch {
            // A mensagem do bloqueio já explica o que fazer.
          }
        }
      } finally {
        startingRef.current = false;
      }
    })();
  }, [active]);

  const resolver = useCallback((resultado: GtaConferenciaResultado) => {
    const snapshot = stateRef.current;
    if (!snapshot.job || snapshot.resolving || resolvingRef.current) return;

    resolvingRef.current = true;
    dispatch({ type: "resolucaoIniciada" });

    void (async () => {
      try {
        const job = await api.resolverGta(snapshot.job!.id, { resultado });
        if (mounted.current) dispatch({ type: "jobResolvido", job });
      } catch (error) {
        if (mounted.current) {
          dispatch({
            type: "resolucaoFalhou",
            mensagem: gtaErrorText(error),
          });
        }
      } finally {
        resolvingRef.current = false;
      }
    })();
  }, []);

  const actions: GtaActions = {
    selecionarAnimal: (unitKey, key) =>
      dispatch({ type: "selecionarAnimal", unitKey, key }),
    alternarGrupo: (unitKey) => dispatch({ type: "alternarGrupo", unitKey }),
    limparSelecao: () => dispatch({ type: "limparSelecao" }),
    continuarAnimais: () => dispatch({ type: "continuarAnimais" }),
    escolherUep: (uep) => dispatch({ type: "escolherUep", uep }),
    voltar: () => dispatch({ type: "voltar" }),
    alternarCampo: (campo) => dispatch({ type: "alternarCampo", campo }),
    mudarFinalidade: (valor) => dispatch({ type: "mudarFinalidade", valor }),
    mudarSaida: (valor) => dispatch({ type: "mudarSaida", valor }),
    mudarValidade: (valor) => dispatch({ type: "mudarValidade", valor }),
    mudarTransporte: (valor) => dispatch({ type: "mudarTransporte", valor }),
    continuarDatas: () => dispatch({ type: "continuarDatas" }),
    responderExtras: (informar) =>
      dispatch({ type: "responderExtras", informar }),
    mudarNotaFiscal: (valor) => dispatch({ type: "mudarNotaFiscal", valor }),
    continuarNotaFiscal: () => dispatch({ type: "continuarNotaFiscal" }),
    mudarPlaca: (valor) => dispatch({ type: "mudarPlaca", valor }),
    continuarPlaca: () => dispatch({ type: "continuarPlaca" }),
    mudarLacre: (valor) => dispatch({ type: "mudarLacre", valor }),
    mudarObservacao: (valor) => dispatch({ type: "mudarObservacao", valor }),
    confirmar: (valor) => dispatch({ type: "confirmar", valor }),
    iniciar,
    resolver,
    ajustar: () => dispatch({ type: "ajustar" }),
    cancelar: () => dispatch({ type: "cancelar" }),
    reiniciar: () => {
      dispatch({ type: "reiniciar" });
      onRestart();
    },
    recarregarOpcoes: () => void loadOptions(),
  };

  return {
    state,
    units,
    origin,
    originKey,
    selectedAnimals,
    actions,
    busy,
  };
}
