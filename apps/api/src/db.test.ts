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
});
