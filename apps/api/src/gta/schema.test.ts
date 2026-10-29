import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  gtaInputSchema,
  isValidIsoDate,
  maskDocumento,
  sanitizeErrorMessage,
  todayIso,
} from "./schema.js";
import type { GtaInput } from "./types.js";

function input(overrides: Partial<GtaInput> = {}): GtaInput {
  const hoje = todayIso();
  return {
    origem: { codigoOficial: "42-900000001", uep: "1" },
    destino: { tipo: "propria", codigoOficial: "42-900000002", uep: "1" },
    animais: [{ key: "999000000067836", brinco: "067836" }],
    finalidade: "ENGORDA",
    dataSaida: addDaysIso(hoje, 1),
    dataValidade: addDaysIso(hoje, 4),
    transporte: "RODOVIÁRIO",
    ...overrides,
  };
}

describe("datas", () => {
  it("hoje está no formato YYYY-MM-DD", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("valida datas reais e rejeita 31 de fevereiro", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
  });

  it("soma dias sem depender do fuso", () => {
    expect(addDaysIso("2026-10-25", 3)).toBe("2026-10-28");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("documentos", () => {
  it("mascara CPF e CNPJ", () => {
    expect(maskDocumento("12345678901")).toBe("***.***.***-01");
    expect(maskDocumento("12345678000199")).toBe("**.***.***/****-99");
  });

  it("remove documentos de mensagens de erro", () => {
    expect(sanitizeErrorMessage("CPF 12345678901 inválido")).toBe(
      "CPF ***.***.***-01 inválido",
    );
    expect(sanitizeErrorMessage("CPF 123.456.789-01 inválido")).toBe(
      "CPF ***.***.***-01 inválido",
    );
    expect(sanitizeErrorMessage("CNPJ 12.345.678/0001-99 recusado")).toBe(
      "CNPJ **.***.***/****-99 recusado",
    );
  });
});

describe("schema da GTA", () => {
  it("aceita um pedido completo", () => {
    const result = gtaInputSchema.safeParse(input());
    expect(result.success).toBe(true);
  });

  it("rejeita destino igual à origem", () => {
    const result = gtaInputSchema.safeParse(
      input({
        destino: { tipo: "propria", codigoOficial: "42-900000001", uep: "1" },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita animais repetidos", () => {
    const result = gtaInputSchema.safeParse(
      input({
        animais: [
          { key: "999000000067836", brinco: "067836" },
          { key: "999000000067836", brinco: "067836" },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita validade anterior à saída", () => {
    const result = gtaInputSchema.safeParse(
      input({
        dataSaida: addDaysIso(todayIso(), 2),
        dataValidade: addDaysIso(todayIso(), 1),
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejeita finalidade e transporte desconhecidos", () => {
    expect(
      gtaInputSchema.safeParse(input({ finalidade: "VENDA" })).success,
    ).toBe(false);
    expect(
      gtaInputSchema.safeParse(input({ transporte: "FOGUETE" })).success,
    ).toBe(false);
  });
});
