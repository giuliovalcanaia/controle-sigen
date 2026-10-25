import type { AnimalStore, GtaRecord } from "../db.js";
import { getMockInventory } from "../sigen/mock.js";
import { SigenError } from "../sigen/types.js";
import {
  GTA_FINALIDADES,
  GTA_MAX_ANIMAIS,
  GTA_TRANSPORTES,
  GTA_UF,
  GTA_VALIDADE_DIAS,
} from "./constants.js";
import type { GtaService } from "./service.js";
import { addDaysIso, gtaHash, todayIso } from "./schema.js";
import type {
  GtaDestinoUep,
  GtaJobView,
  GtaProgresso,
  GtaStatus,
} from "./types.js";

/**
 * Emissão simulada para desenvolver a interface sem SIGEN.
 * Preenche o banco igual ao serviço real, mas conclui com um número falso.
 */
export function createMockGtaService(store: AnimalStore): GtaService {
  const progress = new Map<number, GtaProgresso>();

  function defaultProgress(record: GtaRecord): GtaProgresso {
    const total = record.animais.length;
    return record.status === "preparando" || record.status === "preenchendo"
      ? { etapa: "conferindo", atual: 0, total }
      : { etapa: "concluido", atual: total, total };
  }

  function get(id: number): GtaJobView | null {
    const record = store.getGta(id);
    if (!record) return null;
    const current = progress.get(id) ?? defaultProgress(record);
    return {
      id: record.id,
      status: record.status,
      etapa: current.etapa,
      atual: current.atual,
      total: current.total || record.animais.length,
      numero: record.numero,
      temPdf: false,
      erro: record.erro,
      criadaEm: record.criadaEm,
      atualizadaEm: record.atualizadaEm,
    };
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
        emissaoAtiva: true,
      };
    },

    async lookupDestinos(): Promise<GtaDestinoUep[]> {
      return getMockInventory().propriedades.map((property) => ({
        id: property.codigo,
        codigoOficial: property.codigo,
        uep: property.ueps[0] ?? "1",
        localidade: property.localidade,
        municipio: property.municipio,
        uf: property.uf,
        especie: "BOVINO",
        produtor: null,
      }));
    },

    async start(request) {
      const { input } = request;
      const inventory = getMockInventory();

      const origem = inventory.propriedades.find(
        (property) =>
          property.codigo === input.origem.codigoOficial &&
          property.ueps.includes(input.origem.uep),
      );
      const destino = inventory.propriedades.find(
        (property) =>
          property.codigo === input.destino.codigoOficial &&
          property.ueps.includes(input.destino.uep),
      );

      if (!origem || !destino) {
        throw new SigenError(
          "GTA_UEP_INVALIDA",
          "Não encontrei a propriedade de origem ou de destino.",
          400,
        );
      }

      const available = new Set(origem.animais.map((animal) => animal.key));
      if (input.animais.some((animal) => !available.has(animal.key))) {
        throw new SigenError(
          "GTA_ANIMAIS_DIVERGENTES",
          "Algum animal selecionado não está mais na propriedade de origem.",
          422,
        );
      }

      const id = store.createGta({
        status: "preparando",
        hash: gtaHash(input),
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

      const timer = setTimeout(() => {
        const status: GtaStatus =
          request.modo === "conferir" ? "conferida" : "emitida";
        store.updateGta(id, {
          status,
          numero: status === "emitida" ? "000000001" : null,
          erro: null,
        });
        progress.set(id, {
          etapa: "concluido",
          atual: input.animais.length,
          total: input.animais.length,
        });
      }, 1500);
      timer.unref?.();

      return { id, status: "preparando" };
    },

    get,

    list(limit) {
      return store
        .listGtas(limit)
        .map((record) => get(record.id))
        .filter((job): job is GtaJobView => job !== null);
    },

    pdf() {
      return null;
    },
  };
}
