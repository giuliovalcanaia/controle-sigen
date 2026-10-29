import { describe, expect, it } from "vitest";
import { openAnimalStore } from "../db.js";
import { createEmissao, identidadeDaViagem } from "./emissao.js";
import type { GtaInput } from "./types.js";

const ANIMAL_A = { key: "999000000067836", brinco: "067836" };
const ANIMAL_B = { key: "999000000069054", brinco: "069054" };

function input(overrides: Partial<GtaInput> = {}): GtaInput {
  return {
    origem: { codigoOficial: "42-900000001", uep: "1" },
    destino: { tipo: "propria", codigoOficial: "42-900000002", uep: "1" },
    animais: [ANIMAL_A],
    finalidade: "ENGORDA",
    dataSaida: "2026-10-25",
    dataValidade: "2026-10-28",
    transporte: "RODOVIÁRIO",
    ...overrides,
  };
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`esperava o código ${code}`);
}

describe("identidade da viagem", () => {
  it("não muda com placa, nota, finalidade, destino, transporte ou validade", () => {
    const base = input();
    const outra = input({
      destino: { tipo: "propria", codigoOficial: "42-900000004", uep: "1" },
      finalidade: "REPRODUÇÃO",
      transporte: "AÉREO",
      dataValidade: "2026-10-30",
      notaFiscal: "123",
      placa: "ABC1D23",
      lacre: "L1",
      observacao: "observação",
    });

    expect(identidadeDaViagem(outra)).toBe(identidadeDaViagem(base));
  });

  it("não depende da ordem dos animais", () => {
    const a = input({ animais: [ANIMAL_A, ANIMAL_B] });
    const b = input({ animais: [ANIMAL_B, ANIMAL_A] });

    expect(identidadeDaViagem(a)).toBe(identidadeDaViagem(b));
  });

  it("muda quando mudam os animais, a data ou a origem", () => {
    const base = input();
    const comOutroAnimal = input({ animais: [ANIMAL_B] });
    const outroDia = input({ dataSaida: "2026-10-26" });
    const outraOrigem = input({
      origem: { codigoOficial: "42-900000002", uep: "1" },
    });

    expect(identidadeDaViagem(comOutroAnimal)).not.toBe(identidadeDaViagem(base));
    expect(identidadeDaViagem(outroDia)).not.toBe(identidadeDaViagem(base));
    expect(identidadeDaViagem(outraOrigem)).not.toBe(identidadeDaViagem(base));
  });
});

describe("reserva da viagem", () => {
  it("emite uma vez e bloqueia a segunda tentativa", () => {
    const store = openAnimalStore(":memory:");
    const emissao = createEmissao(store);

    const id = emissao.reservar(input(), "emitir");
    expect(store.getGta(id)?.status).toBe("preparando");

    expectCode(() => emissao.reservar(input(), "emitir"), "GTA_EM_ANDAMENTO");
    expect(store.listGtas(10)).toHaveLength(1);

    store.close();
  });

  it("bloqueia a viagem já emitida, mesmo com placa ou nota diferentes", () => {
    const store = openAnimalStore(":memory:");
    const emissao = createEmissao(store);

    const id = emissao.reservar(input(), "emitir");
    store.updateGta(id, { status: "emitida", numero: "000 123456" });

    expectCode(
      () =>
        emissao.reservar(
          input({ placa: "XYZ9Z99", notaFiscal: "999" }),
          "emitir",
        ),
      "GTA_JA_EMITIDA",
    );

    store.close();
  });

  it("bloqueia animal que já está em outra GTA do mesmo dia", () => {
    const store = openAnimalStore(":memory:");
    const emissao = createEmissao(store);

    const id = emissao.reservar(input(), "emitir");
    store.updateGta(id, { status: "emitida", numero: "000 1" });

    const comDoisAnimais = input({
      destino: { tipo: "propria", codigoOficial: "42-900000004", uep: "1" },
      animais: [ANIMAL_A, ANIMAL_B],
    });

    expectCode(
      () => emissao.reservar(comDoisAnimais, "emitir"),
      "GTA_ANIMAL_JA_SAIU",
    );

    store.close();
  });

  it("libera a viagem depois de conferida como não emitida", () => {
    const store = openAnimalStore(":memory:");
    const emissao = createEmissao(store);

    const id = emissao.reservar(input(), "emitir");
    store.updateGta(id, { status: "incerta" });

    expectCode(() => emissao.reservar(input(), "emitir"), "GTA_INCERTA");

    emissao.resolver(id, "nao_emitida");
    expect(store.getGta(id)?.status).toBe("nao_emitida");
    expect(() => emissao.reservar(input(), "emitir")).not.toThrow();

    store.close();
  });

  it("conferir pode repetir e nunca reserva a viagem", () => {
    const store = openAnimalStore(":memory:");
    const emissao = createEmissao(store);

    const first = emissao.reservar(input(), "conferir");
    const second = emissao.reservar(input(), "conferir");

    expect(first).not.toBe(second);
    expect(store.listGtas(10)).toHaveLength(2);

    // Conferir não emite: depois de concluída, a viagem segue livre.
    store.updateGta(first, { status: "conferida" });
    store.updateGta(second, { status: "conferida" });
    expect(() => emissao.reservar(input(), "emitir")).not.toThrow();

    store.close();
  });
});

describe("conferência da incerta", () => {
  it("marca emitida com o número informado", () => {
    const store = openAnimalStore(":memory:");
    const emissao = createEmissao(store);

    const id = emissao.reservar(input(), "emitir");
    store.updateGta(id, { status: "incerta" });

    const resolved = emissao.resolver(id, "emitida", " 000 123456 ");
    expect(resolved.status).toBe("emitida");
    expect(resolved.numero).toBe("000 123456");
    expect(resolved.erro).toBeNull();

    expectCode(() => emissao.resolver(id, "emitida"), "GTA_NAO_INCERTA");

    store.close();
  });

  it("recusa id inexistente e GTA que não está incerta", () => {
    const store = openAnimalStore(":memory:");
    const emissao = createEmissao(store);

    expectCode(() => emissao.resolver(999, "emitida"), "GTA_NAO_ENCONTRADA");

    const id = emissao.reservar(input(), "conferir");
    expectCode(() => emissao.resolver(id, "emitida"), "GTA_NAO_INCERTA");

    store.close();
  });
});
