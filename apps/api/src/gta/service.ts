import type { Page } from "playwright";
import type { AnimalStore, GtaRecord } from "../db.js";
import type { SigenClient } from "../sigen/client.js";
import { PlaywrightGtaForm, gtaErrorMessage, type GtaForm } from "../sigen/gta.js";
import type { SigenSession } from "../sigen/session.js";
import { SigenError } from "../sigen/types.js";
import {
  GTA_FINALIDADES,
  GTA_MAX_ANIMAIS,
  GTA_TRANSPORTES,
  GTA_UF,
  GTA_VALIDADE_DIAS,
} from "./constants.js";
import type { GtaPdfStore } from "./pdf.js";
import { runGtaJob } from "./runner.js";
import { addDaysIso, gtaHash, todayIso } from "./schema.js";
import type {
  GtaDestinoUep,
  GtaFormInput,
  GtaJobView,
  GtaOptions,
  GtaProgresso,
  GtaStartRequest,
  GtaStatus,
} from "./types.js";

export type GtaService = {
  options(): GtaOptions;
  lookupDestinos(cpf: string, dataSaida: string): Promise<GtaDestinoUep[]>;
  start(request: GtaStartRequest): Promise<{ id: number; status: GtaStatus }>;
  get(id: number): GtaJobView | null;
  list(limit: number): GtaJobView[];
  pdf(id: number): Buffer | null;
};

export type GtaServiceDeps = {
  client: SigenClient;
  session: SigenSession;
  store: AnimalStore;
  pdfs: GtaPdfStore;
  baseUrl: string;
  emissaoAtiva: boolean;
  /** Injetável nos testes. */
  formFactory?: (page: Page) => GtaForm;
};

const DUPLICATE_WINDOW_MS = 30 * 60_000;
const STALE_WINDOW_MS = 10 * 60_000;

function defaultProgress(record: GtaRecord): GtaProgresso {
  const total = record.animais.length;
  switch (record.status) {
    case "preparando":
      return { etapa: "conferindo", atual: 0, total };
    case "preenchendo":
      return { etapa: "abrindo", atual: 0, total };
    case "salvando":
      return { etapa: "salvando", atual: total, total };
    default:
      return { etapa: "concluido", atual: total, total };
  }
}

export function createGtaService(deps: GtaServiceDeps): GtaService {
  const {
    client,
    session,
    store,
    pdfs,
    baseUrl,
    emissaoAtiva,
    formFactory = (page: Page) => new PlaywrightGtaForm(page, baseUrl),
  } = deps;

  const progress = new Map<number, GtaProgresso>();

  // Um processo que caiu no meio de uma emissão não pode ficar "salvando"
  // para sempre: vira incerta e o produtor confere no SIGEN.
  store.recoverStaleGtas(
    new Date(Date.now() - STALE_WINDOW_MS).toISOString(),
    "O processo foi interrompido no meio da emissão. Confira no SIGEN antes de tentar de novo.",
  );

  function get(id: number): GtaJobView | null {
    const record = store.getGta(id);
    if (!record) return null;

    const current = progress.get(id) ?? defaultProgress(record);
    const total = current.total || record.animais.length;

    return {
      id: record.id,
      status: record.status,
      etapa: current.etapa,
      atual: current.atual,
      total,
      numero: record.numero,
      temPdf: Boolean(record.pdfPath),
      erro: record.erro,
      criadaEm: record.criadaEm,
      atualizadaEm: record.atualizadaEm,
    };
  }

  async function run(
    id: number,
    input: GtaFormInput,
    modo: "conferir" | "emitir",
  ): Promise<void> {
    let saveStarted = false;

    try {
      store.updateGta(id, { status: "preenchendo" });
      progress.set(id, {
        etapa: "abrindo",
        atual: 0,
        total: input.animais.length,
      });

      const result = await session.withWritePage(async (page) => {
        const form = formFactory(page);
        return runGtaJob(
          form,
          input,
          modo,
          (atual, total) => {
            progress.set(id, { etapa: "animais", atual, total });
          },
          () => {
            saveStarted = true;
            store.updateGta(id, { status: "salvando" });
            progress.set(id, {
              etapa: "salvando",
              atual: input.animais.length,
              total: input.animais.length,
            });
          },
        );
      });

      if (result.status === "conferida") {
        store.updateGta(id, { status: "conferida", erro: null });
        progress.set(id, {
          etapa: "concluido",
          atual: input.animais.length,
          total: input.animais.length,
        });
        return;
      }

      let pdfPath: string | null = null;
      if (result.pdf) {
        try {
          pdfPath = pdfs.save(id, result.pdf);
        } catch {
          pdfPath = null;
        }
      }

      store.updateGta(id, {
        status: "emitida",
        numero: result.numero,
        pdfPath,
        erro: null,
      });
      progress.set(id, {
        etapa: "concluido",
        atual: input.animais.length,
        total: input.animais.length,
      });
    } catch (error) {
      const code =
        error instanceof SigenError ? error.code : "GTA_INDISPONIVEL";

      // Depois do POST de criação, qualquer falha ambígua é incerta: a GTA
      // pode ter sido emitida, e repetir sozinho poderia duplicar.
      if (saveStarted && code !== "GTA_SIGEN_RECUSOU") {
        store.updateGta(id, {
          status: "incerta",
          erro:
            "Não sei se a GTA foi emitida. Confira no SIGEN antes de tentar de novo.",
        });
      } else {
        store.updateGta(id, {
          status: "erro",
          erro: gtaErrorMessage(error),
        });
      }

      progress.set(id, {
        etapa: "concluido",
        atual: 0,
        total: input.animais.length,
      });
    }
  }

  return {
    options() {
      const hoje = todayIso();
      return {
        finalidades: [...GTA_FINALIDADES],
        transportes: [...GTA_TRANSPORTES],
        hoje,
        validadePadrao: addDaysIso(hoje, GTA_VALIDADE_DIAS),
        maxAnimais: GTA_MAX_ANIMAIS,
        uf: GTA_UF,
        emissaoAtiva,
      };
    },

    lookupDestinos(cpf, dataSaida) {
      const data = /^\d{4}-\d{2}-\d{2}$/.test(dataSaida)
        ? dataSaida
        : todayIso();
      return client.quickSearchUeps(cpf, data);
    },

    async start(request) {
      if (request.modo === "emitir" && !emissaoAtiva) {
        throw new SigenError(
          "GTA_INDISPONIVEL",
          "A emissão de GTA está desativada neste servidor. Use “Conferir no SIGEN” ou finalize manualmente.",
          503,
        );
      }

      const { input } = request;
      const ueps = await client.getUeps();
      const findUep = (codigo: string, nr: string) =>
        ueps.find(
          (uep) =>
            uep.especie?.toUpperCase() === "BOVINO" &&
            uep.codigoOficial === codigo &&
            uep.nr === nr,
        );

      const origem = findUep(input.origem.codigoOficial, input.origem.uep);
      const destinoInput = input.destino;
      const destino =
        destinoInput.tipo === "terceiro"
          ? (
              await client.quickSearchUeps(
                destinoInput.cpf,
                input.dataSaida,
              )
            ).find(
              (uep) =>
                uep.codigoOficial === destinoInput.codigoOficial &&
                uep.uep === destinoInput.uep,
            )
          : findUep(destinoInput.codigoOficial, destinoInput.uep);

      if (!origem || !destino) {
        throw new SigenError(
          "GTA_UEP_INVALIDA",
          "Não encontrei a propriedade de origem ou de destino no SIGEN.",
          400,
        );
      }

      if (
        (origem.uf && origem.uf !== GTA_UF) ||
        (destino.uf && destino.uf !== GTA_UF)
      ) {
        throw new SigenError(
          "GTA_UEP_INVALIDA",
          "Por enquanto a GTA é emitida somente dentro de Santa Catarina.",
          400,
        );
      }

      const hash = gtaHash(input);

      if (request.modo === "emitir") {
        const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();

        const active = store.findRecentGta(
          hash,
          ["preparando", "preenchendo", "salvando"],
          since,
        );
        if (active) {
          throw new SigenError(
            "GTA_EM_ANDAMENTO",
            "Já existe uma emissão desta mesma GTA em andamento.",
            409,
          );
        }

        const incerta = store.findRecentGta(hash, ["incerta"], since);
        if (incerta) {
          throw new SigenError(
            "GTA_INCERTA",
            "A última tentativa desta GTA ficou incerta. Confira no SIGEN antes de tentar de novo.",
            409,
          );
        }

        const emitida = store.findRecentGta(hash, ["emitida"], since);
        if (emitida && !request.forcar) {
          throw new SigenError(
            "GTA_JA_EMITIDA",
            emitida.numero
              ? `Esta GTA já foi emitida (nº ${emitida.numero}).`
              : "Esta GTA já foi emitida há pouco.",
            409,
          );
        }
      }

      const id = store.createGta({
        status: "preparando",
        hash,
        origemCodigo: input.origem.codigoOficial,
        origemUep: input.origem.uep,
        destinoCodigo: input.destino.codigoOficial,
        destinoUep: input.destino.uep,
        finalidade: input.finalidade,
        dataSaida: input.dataSaida,
        dataValidade: input.dataValidade,
        animais: input.animais.map((animal) => animal.key),
      });

      progress.set(id, {
        etapa: "conferindo",
        atual: 0,
        total: input.animais.length,
      });

      const formInput: GtaFormInput = {
        ...input,
        origemUepId: origem.id,
        destinoUepId: destino.id,
        documentoOrigem: "",
        documentoDestino:
          input.destino.tipo === "terceiro" ? input.destino.cpf : "",
      };

      void run(id, formInput, request.modo);

      return { id, status: "preparando" as GtaStatus };
    },

    get,

    list(limit) {
      return store
        .listGtas(limit)
        .map((record) => get(record.id))
        .filter((job): job is GtaJobView => job !== null);
    },

    pdf(id) {
      const record = store.getGta(id);
      if (!record?.pdfPath) return null;
      return pdfs.read(id);
    },
  };
}
