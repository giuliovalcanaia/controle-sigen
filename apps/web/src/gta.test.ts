import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  animalSelectionSummary,
  animalsForUep,
  buildGtaInput,
  buildOriginUnits,
  formatIsoBr,
  gtaStageText,
  gtaStatusText,
  maskDocumento,
  propertyUep,
} from "./gta";
import type { Animal, GtaJobView, Inventory, PropertyInventory } from "./types";

function animal(key: string, brinco: string, uep?: string): Animal {
  return {
    key,
    brinco,
    brincoOficial: key,
    uep,
    sexo: "Fêmea",
    idade: { anos: 1, meses: 2 },
    nascimento: "2025-01-01",
    apelido: null,
    fotoVersao: null,
  };
}

const property: PropertyInventory = {
  codigo: "42-000165623",
  localidade: "Capivari",
  municipio: "Doutor Pedrinho",
  uf: "SC",
  ueps: ["1"],
  animais: [
    animal("076000003067836", "067836", "1"),
    animal("076000003069054", "069054", "1"),
    animal("105420236855019", "685501", "2"),
    animal("076000009702664", "702664"),
  ],
};

function job(overrides: Partial<GtaJobView> = {}): GtaJobView {
  return {
    id: 1,
    status: "preparando",
    etapa: "conferindo",
    atual: 0,
    total: 1,
    numero: null,
    temPdf: false,
    erro: null,
    criadaEm: "2026-10-25T10:00:00.000Z",
    atualizadaEm: "2026-10-25T10:00:00.000Z",
    ...overrides,
  };
}

describe("GTA no cliente", () => {
  it("usa a primeira UEP da propriedade", () => {
    expect(propertyUep(property)).toBe("1");
    expect(propertyUep({ ...property, ueps: [] })).toBe("1");
  });

  it("filtra animais pela UEP, mantendo os antigos sem UEP", () => {
    expect(animalsForUep(property, "1").map((item) => item.brinco)).toEqual([
      "067836",
      "069054",
      "702664",
    ]);
    expect(animalsForUep(property, "2").map((item) => item.brinco)).toEqual([
      "685501",
      "702664",
    ]);
  });

  it("formata datas sem depender do fuso", () => {
    expect(formatIsoBr("2026-10-25")).toBe("25/10/2026");
    expect(addDaysIso("2026-10-25", 3)).toBe("2026-10-28");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("monta o pedido para uma propriedade própria", () => {
    const input = buildGtaInput({
      origem: property,
      origemUep: "1",
      destino: {
        tipo: "propria",
        property: { ...property, codigo: "42-000261071" },
        uep: "1",
      },
      animais: [property.animais[0]!, property.animais[1]!],
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      transporte: "RODOVIÁRIO",
      notaFiscal: " 123 ",
      placa: " ABC1D23 ",
      lacre: "  ",
      observacao: "  ",
    });

    expect(input).toEqual({
      origem: { codigoOficial: "42-000165623", uep: "1" },
      destino: {
        tipo: "propria",
        codigoOficial: "42-000261071",
        uep: "1",
      },
      animais: [
        { key: "076000003067836", brinco: "067836" },
        { key: "076000003069054", brinco: "069054" },
      ],
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      transporte: "RODOVIÁRIO",
      notaFiscal: "123",
      placa: "ABC1D23",
    });
  });

  it("monta o pedido para um destino de terceiro", () => {
    const input = buildGtaInput({
      origem: property,
      origemUep: "1",
      destino: {
        tipo: "terceiro",
        cpf: "12345678901",
        uep: {
          id: "911677",
          codigoOficial: "42-000311195",
          uep: "1",
          localidade: "Coqueiral",
          municipio: "Doutor Pedrinho",
          uf: "SC",
          especie: "BOVINO",
          produtor: "Vizinho",
        },
      },
      animais: [property.animais[0]!],
      finalidade: "REPRODUÇÃO",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      transporte: "AÉREO",
      notaFiscal: "",
      placa: "",
      lacre: "",
      observacao: "",
    });

    expect(input.destino).toEqual({
      tipo: "terceiro",
      cpf: "12345678901",
      codigoOficial: "42-000311195",
      uep: "1",
    });
  });

  it("descreve as etapas com o progresso dos animais", () => {
    expect(
      gtaStageText(
        job({ etapa: "animais", atual: 3, total: 12, status: "preenchendo" }),
      ),
    ).toBe("Adicionando animal 3 de 12...");
    expect(
      gtaStageText(job({ etapa: "salvando", status: "salvando" })),
    ).toBe("Salvando a GTA...");
    expect(
      gtaStageText(job({ etapa: "concluido", status: "conferida" })),
    ).toBe("Conferência concluída.");
  });

  it("traduz os estados", () => {
    expect(gtaStatusText("emitida")).toBe("Emitida");
    expect(gtaStatusText("conferida")).toBe("Conferida");
    expect(gtaStatusText("incerta")).toBe("Conferir no SIGEN");
    expect(gtaStatusText("salvando")).toBe("Em andamento");
  });

  it("separa a origem por propriedade e UEP", () => {
    const inventory: Inventory = {
      buscadoEm: "2026-10-25T10:00:00.000Z",
      total: property.animais.length,
      avisos: [],
      propriedades: [property],
    };

    const units = buildOriginUnits(inventory);

    expect(units.map((unit) => [unit.property.codigo, unit.uep])).toEqual([
      ["42-000165623", "1"],
      ["42-000165623", "2"],
    ]);
    expect(units[0]?.animals.map((item) => item.brinco)).toEqual([
      "067836",
      "069054",
      "702664",
    ]);
    expect(units[1]?.animals.map((item) => item.brinco)).toEqual(["685501"]);
  });

  it("não cria unidade de origem sem animais", () => {
    const inventory: Inventory = {
      buscadoEm: "2026-10-25T10:00:00.000Z",
      total: 0,
      avisos: [],
      propriedades: [
        {
          codigo: "42-000261676",
          localidade: "Capivari",
          municipio: "Doutor Pedrinho",
          uf: "SC",
          ueps: ["2"],
          animais: [],
        },
      ],
    };

    expect(buildOriginUnits(inventory)).toEqual([]);
  });

  it("mascara CPF e CNPJ sem perder os dois últimos dígitos", () => {
    expect(maskDocumento("12345678901")).toBe("***.***.***-01");
    expect(maskDocumento("123.456.789-01")).toBe("***.***.***-01");
    expect(maskDocumento("12345678000199")).toBe("**.***.***/****-99");
    expect(maskDocumento("123")).toBe("***");
  });

  it("resume a seleção de animais pelo nome e pelo manejo", () => {
    const mimosa = { ...property.animais[0]!, apelido: "Mimosa" };
    const estrela = { ...property.animais[1]!, apelido: "Estrela" };

    expect(animalSelectionSummary([mimosa, estrela])).toBe(
      "Mimosa (067836), Estrela (069054)",
    );
    expect(animalSelectionSummary([property.animais[2]!])).toBe(
      "Brinco 685501",
    );
    expect(
      animalSelectionSummary([
        mimosa,
        estrela,
        property.animais[2]!,
        property.animais[3]!,
      ]),
    ).toBe("Mimosa (067836), Estrela (069054), Brinco 685501 e mais 1");
  });
});
