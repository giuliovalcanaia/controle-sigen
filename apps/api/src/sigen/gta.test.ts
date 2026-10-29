import { describe, expect, it } from "vitest";
import { conferirOpcionais } from "./gta.js";
import type { GtaFormInput } from "../gta/types.js";

function input(overrides: Partial<GtaFormInput> = {}): GtaFormInput {
  return {
    origem: { codigoOficial: "42-900000001", uep: "1" },
    destino: { tipo: "propria", codigoOficial: "42-900000002", uep: "1" },
    animais: [{ key: "999000000067836", brinco: "067836" }],
    finalidade: "ENGORDA",
    dataSaida: "2026-10-25",
    dataValidade: "2026-10-28",
    transporte: "RODOVIÁRIO",
    origemUepId: "169696",
    destinoUepId: "669790",
    documentoOrigem: "",
    documentoDestino: "",
    ...overrides,
  };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    nrNotaFiscal: "",
    nrPlaca: "",
    nrLacre: "",
    dsObservacao: "",
    ...overrides,
  };
}

describe("conferência dos opcionais", () => {
  it("aceita os quatro campos vazios", () => {
    expect(conferirOpcionais(body(), input())).toBeNull();
  });

  it("aceita placa em caixa diferente", () => {
    expect(
      conferirOpcionais(
        body({ nrPlaca: "abc1d23" }),
        input({ placa: "ABC1D23" }),
      ),
    ).toBeNull();
  });

  it("aceita nota numérica devolvida pelo SIGEN", () => {
    expect(
      conferirOpcionais(
        body({ nrNotaFiscal: 12345 }),
        input({ notaFiscal: "12345" }),
      ),
    ).toBeNull();
  });

  it("recusa placa divergente", () => {
    expect(
      conferirOpcionais(
        body({ nrPlaca: "XYZ9Z99" }),
        input({ placa: "ABC1D23" }),
      ),
    ).toBe("A placa não confere.");
  });

  it("recusa quando o campo sumiu do payload", () => {
    expect(
      conferirOpcionais({}, input({ notaFiscal: "123" })),
    ).toBe("A nota fiscal não confere.");
  });

  it("recusa valor inesperado no payload quando o produtor deixou vazio", () => {
    expect(
      conferirOpcionais(
        body({ nrLacre: "L1" }),
        input({ lacre: "" }),
      ),
    ).toBe("O lacre não confere.");
  });
});
