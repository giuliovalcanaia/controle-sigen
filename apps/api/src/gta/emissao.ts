import { createHash } from "node:crypto";
import type { AnimalStore, GtaRecord } from "../db.js";
import { SigenError } from "../sigen/types.js";
import type {
  GtaConferenciaResultado,
  GtaInput,
  GtaStatus,
} from "./types.js";

/**
 * Política de emissão da GTA.
 *
 * Uma **viagem** é a saída de um conjunto de animais de uma propriedade numa
 * data. Placa, nota, finalidade, destino e transporte são atributos da viagem:
 * mudá-los não libera uma segunda GTA. O SIGEN é a fonte da verdade para a
 * situação do animal; aqui garantimos que o app não emita a mesma viagem duas
 * vezes.
 */
export function identidadeDaViagem(input: GtaInput): string {
  const canonical = {
    origem: {
      codigoOficial: input.origem.codigoOficial,
      uep: input.origem.uep,
    },
    dataSaida: input.dataSaida,
    animais: [...input.animais].map((animal) => animal.key).sort(),
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export type Emissao = {
  /**
   * Cria o registro da GTA. Em `emitir`, reserva a viagem de forma atômica;
   * em `conferir`, apenas registra o progresso (nada é emitido).
   *
   * Lança `SigenError` quando a viagem (ou um animal dela) já está bloqueada.
   */
  reservar(input: GtaInput, modo: "conferir" | "emitir"): number;
  /** Resolve uma GTA incerta com a resposta do produtor. */
  resolver(
    id: number,
    resultado: GtaConferenciaResultado,
    numero?: string,
  ): GtaRecord;
};

function referencia(record: GtaRecord): string {
  return record.numero ? ` (nº ${record.numero})` : "";
}

function bloqueioPorViagem(record: GtaRecord): SigenError {
  switch (record.status) {
    case "incerta":
      return new SigenError(
        "GTA_INCERTA",
        `A última tentativa desta viagem ficou incerta${referencia(record)}. Confira no SIGEN antes de tentar de novo.`,
        409,
        { gtaId: record.id },
      );
    case "emitida":
      return new SigenError(
        "GTA_JA_EMITIDA",
        `Esta viagem já foi emitida${referencia(record)}. Para corrigir, use o SIGEN.`,
        409,
      );
    default:
      return new SigenError(
        "GTA_EM_ANDAMENTO",
        "Esta mesma viagem já está sendo emitida.",
        409,
      );
  }
}

function bloqueioPorAnimal(
  record: GtaRecord,
  input: GtaInput,
): SigenError {
  const brincos = input.animais
    .filter((animal) => record.animais.includes(animal.key))
    .map((animal) => animal.brinco);
  const rotulo = brincos.length > 0 ? `O animal ${brincos.join(", ")}` : "Um dos animais";

  if (record.status === "incerta") {
    return new SigenError(
      "GTA_INCERTA",
      `${rotulo} está numa GTA incerta de hoje${referencia(record)}. Confira no SIGEN antes de tentar de novo.`,
      409,
      { gtaId: record.id },
    );
  }
  if (record.status === "emitida") {
    return new SigenError(
      "GTA_ANIMAL_JA_SAIU",
      `${rotulo} já saiu em outra GTA de hoje${referencia(record)}. Para corrigir, use o SIGEN.`,
      409,
    );
  }
  return new SigenError(
    "GTA_EM_ANDAMENTO",
    `${rotulo} está em outra GTA que ainda está sendo emitida.`,
    409,
  );
}

function statusDeConferencia(
  resultado: GtaConferenciaResultado,
): GtaStatus {
  return resultado === "emitida" ? "emitida" : "nao_emitida";
}

export function createEmissao(store: AnimalStore): Emissao {
  return {
    reservar(input, modo) {
      const novo = {
        status: "preparando" as const,
        modo,
        identidade: identidadeDaViagem(input),
        origemCodigo: input.origem.codigoOficial,
        origemUep: input.origem.uep,
        destinoCodigo: input.destino.codigoOficial,
        destinoUep: input.destino.uep,
        finalidade: input.finalidade,
        dataSaida: input.dataSaida,
        dataValidade: input.dataValidade,
        animais: input.animais.map((animal) => animal.key),
      };

      // Conferir não emite nada: pode repetir à vontade e nunca reserva a viagem.
      if (modo === "conferir") return store.createGta(novo);

      const claim = store.criarGtaSeLivre(novo);
      if (!claim.ok) {
        throw claim.motivo === "animal"
          ? bloqueioPorAnimal(claim.existente, input)
          : bloqueioPorViagem(claim.existente);
      }
      return claim.id;
    },

    resolver(id, resultado, numero) {
      const current = store.getGta(id);
      if (!current) {
        throw new SigenError(
          "GTA_NAO_ENCONTRADA",
          "Emissão de GTA não encontrada.",
          404,
        );
      }
      if (current.status !== "incerta") {
        throw new SigenError(
          "GTA_NAO_INCERTA",
          "Esta GTA não está incerta; não há o que conferir.",
          409,
        );
      }

      const emitida = resultado === "emitida";
      const atualizada = store.resolverIncerteza(id, {
        status: statusDeConferencia(resultado),
        numero: emitida ? numero?.trim() || null : null,
        erro: emitida ? null : "Conferido no SIGEN: a GTA não foi emitida.",
      });

      if (!atualizada) {
        throw new SigenError(
          "GTA_NAO_INCERTA",
          "Esta GTA já foi conferida.",
          409,
        );
      }

      return store.getGta(id)!;
    },
  };
}
