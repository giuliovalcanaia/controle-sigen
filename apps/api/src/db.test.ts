import { describe, expect, it } from "vitest";
import { openNicknameStore } from "./db.js";

describe("openNicknameStore", () => {
  it("grava, lê e remove apelidos", () => {
    const store = openNicknameStore(":memory:");

    store.set("076000003067836", "Mimosa");
    store.set("076000003069054", "Estrela");
    expect(store.all()).toEqual(
      new Map([
        ["076000003067836", "Mimosa"],
        ["076000003069054", "Estrela"],
      ]),
    );

    store.set("076000003067836", "Mimosinha");
    expect(store.all().get("076000003067836")).toBe("Mimosinha");

    store.remove("076000003069054");
    expect(store.all().has("076000003069054")).toBe(false);

    store.close();
  });
});
