import type {
  Animal,
  GtaDestino,
  GtaDestinoUep,
  GtaInput,
  GtaJobView,
  GtaStatus,
  Inventory,
  PropertyInventory,
} from "./types";

export const GTA_FINALIDADE_PADRAO = "ENGORDA";
export const GTA_TRANSPORTE_PADRAO = "RODOVIÁRIO";
export const GTA_VALIDADE_DIAS = 3;
export const GTA_MAX_DIAS_VALIDADE = 30;

export type GtaDestinoChoice =
  | { tipo: "propria"; property: PropertyInventory; uep: string }
  | { tipo: "terceiro"; cpf: string; uep: GtaDestinoUep };

export type GtaOriginUnit = {
  key: string;
  property: PropertyInventory;
  uep: string;
  animals: Animal[];
};

/**
 * Separa o inventário em unidades de origem (propriedade + UEP).
 * Uma GTA só pode ter uma origem, então a seleção de animais fica dentro
 * de uma única unidade.
 */
export function buildOriginUnits(inventory: Inventory): GtaOriginUnit[] {
  const units: GtaOriginUnit[] = [];

  for (const property of inventory.propriedades) {
    const ueps = new Set<string>(property.ueps.length > 0 ? property.ueps : ["1"]);
    for (const animal of property.animais) {
      if (animal.uep) ueps.add(animal.uep);
    }

    const sorted = [...ueps].sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true }),
    );
    const first = sorted[0] ?? "1";

    for (const uep of sorted) {
      const animals = property.animais.filter((animal) =>
        animal.uep ? animal.uep === uep : uep === first,
      );
      if (animals.length === 0) continue;

      units.push({
        key: `${property.codigo}-${uep}`,
        property,
        uep,
        animals,
      });
    }
  }

  return units;
}

export function maskDocumento(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `***.***.***-${digits.slice(-2)}`;
  if (digits.length === 14) return `**.***.***/****-${digits.slice(-2)}`;
  return "***";
}

export function animalSelectionSummary(animals: Animal[]): string {
  const labels = animals.map((animal) =>
    animal.apelido?.trim()
      ? `${animal.apelido.trim()} (${animal.brinco})`
      : `Brinco ${animal.brinco}`,
  );

  if (labels.length <= 3) return labels.join(", ");
  return `${labels.slice(0, 3).join(", ")} e mais ${labels.length - 3}`;
}

export function propertyUep(property: PropertyInventory): string {
  return property.ueps[0] ?? "1";
}

export function animalsForUep(
  property: PropertyInventory,
  uep: string,
): Animal[] {
  return property.animais.filter(
    (animal) => !animal.uep || animal.uep === uep,
  );
}

export function formatIsoBr(iso: string): string {
  const [year = "", month = "", day = ""] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [year = 0, month = 0, day = 0] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildGtaInput(params: {
  origem: PropertyInventory;
  origemUep: string;
  destino: GtaDestinoChoice;
  animais: Animal[];
  finalidade: string;
  dataSaida: string;
  dataValidade: string;
  transporte: string;
  notaFiscal: string;
  placa: string;
  lacre: string;
  observacao: string;
}): GtaInput {
  const destino: GtaDestino =
    params.destino.tipo === "propria"
      ? {
          tipo: "propria",
          codigoOficial: params.destino.property.codigo,
          uep: params.destino.uep,
        }
      : {
          tipo: "terceiro",
          cpf: params.destino.cpf,
          codigoOficial: params.destino.uep.codigoOficial,
          uep: params.destino.uep.uep,
        };

  const clean = (value: string) => value.trim();

  return {
    origem: { codigoOficial: params.origem.codigo, uep: params.origemUep },
    destino,
    animais: params.animais.map((animal) => ({
      key: animal.key,
      brinco: animal.brinco,
    })),
    finalidade: params.finalidade,
    dataSaida: params.dataSaida,
    dataValidade: params.dataValidade,
    transporte: params.transporte,
    ...(clean(params.notaFiscal)
      ? { notaFiscal: clean(params.notaFiscal) }
      : {}),
    ...(clean(params.placa) ? { placa: clean(params.placa) } : {}),
    ...(clean(params.lacre) ? { lacre: clean(params.lacre) } : {}),
    ...(clean(params.observacao)
      ? { observacao: clean(params.observacao) }
      : {}),
  };
}

export function gtaStatusText(status: GtaStatus): string {
  switch (status) {
    case "preparando":
    case "preenchendo":
    case "salvando":
      return "Em andamento";
    case "conferida":
      return "Conferida";
    case "emitida":
      return "Emitida";
    case "incerta":
      return "Conferir no SIGEN";
    case "erro":
      return "Erro";
  }
}

export function gtaStageText(job: GtaJobView | null): string {
  if (!job) return "Preparando a GTA...";

  switch (job.etapa) {
    case "conferindo":
      return "Conferindo os dados...";
    case "abrindo":
      return "Abrindo o SIGEN...";
    case "origem":
      return "Selecionando a propriedade de origem...";
    case "destino":
      return "Selecionando a propriedade de destino...";
    case "finalidade":
      return "Preenchendo a finalidade...";
    case "animais":
      return job.total > 0
        ? `Adicionando animal ${job.atual} de ${job.total}...`
        : "Adicionando os animais...";
    case "dados":
      return "Preenchendo os dados da GTA...";
    case "salvando":
      return "Salvando a GTA...";
    case "pdf":
      return "Baixando o PDF da GTA...";
    case "concluido":
      return job.status === "conferida"
        ? "Conferência concluída."
        : "Concluído.";
  }
}
