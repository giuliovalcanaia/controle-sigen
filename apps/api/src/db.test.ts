import { describe, expect, it } from "vitest";
import { openAnimalStore } from "./db.js";

describe("openAnimalStore", () => {
  it("grava, lê e remove apelidos", () => {
    const store = openAnimalStore(":memory:");

    store.setNickname("076000003067836", "Mimosa");
    store.setNickname("076000003069054", "Estrela");
    expect(store.nicknames()).toEqual(
      new Map([
        ["076000003067836", "Mimosa"],
        ["076000003069054", "Estrela"],
      ]),
    );

    store.setNickname("076000003067836", "Mimosinha");
    expect(store.nicknames().get("076000003067836")).toBe("Mimosinha");

    store.removeNickname("076000003069054");
    expect(store.nicknames().has("076000003069054")).toBe(false);

    store.close();
  });

  it("guarda a versão da foto e sempre avança", () => {
    const store = openAnimalStore(":memory:");
    const chave = "076000003067836";

    expect(store.photoVersion(chave)).toBeNull();

    const primeira = store.setPhoto(chave, 1234);
    expect(store.photoVersion(chave)).toBe(primeira);
    expect(store.photoVersions().get(chave)).toBe(primeira);

    const segunda = store.setPhoto(chave, 4321);
    expect(segunda).toBeGreaterThan(primeira);
    expect(store.photoVersions().get(chave)).toBe(segunda);

    store.removePhoto(chave);
    expect(store.photoVersion(chave)).toBeNull();
    expect(store.photoVersions().size).toBe(0);

    store.close();
  });

  it("grava, atualiza e lista GTA", () => {
    const store = openAnimalStore(":memory:");

    const id = store.createGta({
      status: "preparando",
      hash: "abc123",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000261071",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      animais: ["076000003067836", "076000003069054"],
    });

    const created = store.getGta(id);
    expect(created?.status).toBe("preparando");
    expect(created?.animais).toEqual([
      "076000003067836",
      "076000003069054",
    ]);
    expect(created?.numero).toBeNull();

    store.updateGta(id, {
      status: "emitida",
      numero: "000 123456",
      pdfPath: "/tmp/gta.pdf",
    });

    const updated = store.getGta(id);
    expect(updated?.status).toBe("emitida");
    expect(updated?.numero).toBe("000 123456");
    expect(updated?.pdfPath).toBe("/tmp/gta.pdf");
    expect(store.listGtas(10)).toHaveLength(1);

    store.close();
  });

  it("encontra GTA recente por hash e status", () => {
    const store = openAnimalStore(":memory:");
    const id = store.createGta({
      status: "emitida",
      hash: "hash",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000261071",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      animais: ["076000003067836"],
    });
    store.updateGta(id, { numero: "000 1" });

    const since = new Date(Date.now() - 60_000).toISOString();
    expect(store.findRecentGta("hash", ["emitida"], since)?.id).toBe(id);
    expect(store.findRecentGta("hash", ["preparando"], since)).toBeNull();
    expect(store.findRecentGta("outro", ["emitida"], since)).toBeNull();

    store.close();
  });

  it("recupera GTA travada como incerta", () => {
    const store = openAnimalStore(":memory:");
    const id = store.createGta({
      status: "salvando",
      hash: "hash",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000261071",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      animais: ["076000003067836"],
    });

    const changed = store.recoverStaleGtas(
      new Date(Date.now() + 1000).toISOString(),
      "Interrompido.",
    );
    expect(changed).toBe(1);

    const recovered = store.getGta(id);
    expect(recovered?.status).toBe("incerta");
    expect(recovered?.erro).toBe("Interrompido.");

    store.close();
  });
});
