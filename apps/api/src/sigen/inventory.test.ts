import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { groupInventories, mergeExtras } from "./inventory.js";
import { parseInventoryText } from "./pdf.js";

const fixturesDir = fileURLToPath(new URL("../../../../fixtures/inventory", import.meta.url));

function allParsed() {
  return fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".txt"))
    .sort()
    .map((file) => parseInventoryText(fs.readFileSync(path.join(fixturesDir, file), "utf8")));
}

describe("groupInventories", () => {
  it("agrupa as quatro propriedades e soma 12 bovinos", () => {
    const inventory = groupInventories(allParsed());

    expect(inventory.propriedades).toHaveLength(4);
    expect(inventory.total).toBe(12);

    const porCodigo = new Map(
      inventory.propriedades.map((property) => [property.codigo, property]),
    );
    expect(porCodigo.get("42-900000001")?.animais).toHaveLength(4);
    expect(porCodigo.get("42-900000002")?.animais).toHaveLength(3);
    expect(porCodigo.get("42-900000004")?.animais).toHaveLength(5);
    expect(porCodigo.get("42-900000003")?.animais).toHaveLength(0);
  });

  it("mantém a propriedade sem animais", () => {
    const inventory = groupInventories(allParsed());
    const vazia = inventory.propriedades.find((p) => p.codigo === "42-900000003");
    expect(vazia).toBeDefined();
    expect(vazia?.animais).toHaveLength(0);
    expect(vazia?.localidade).toBe("Sede");
  });

  it("ignora espécies que não sejam BOVINO", () => {
    const parsed = allParsed();
    const suino = parsed.find((item) => item.codigoOficial === "42-900000002");
    if (!suino) throw new Error("fixture ausente");
    suino.especie = "SUINO";

    const inventory = groupInventories(parsed);
    const ribeirao = inventory.propriedades.find((p) => p.codigo === "42-900000002");
    expect(ribeirao).toBeUndefined();
    expect(inventory.total).toBe(9);
  });

  it("mescla apelidos sem alterar os dados do SIGEN", () => {
    const inventory = groupInventories(allParsed());
    const alvo = inventory.propriedades
      .flatMap((property) => property.animais)
      .find((animal) => animal.brinco === "233768");
    if (!alvo) throw new Error("animal ausente");

    const merged = mergeExtras(inventory, new Map([[alvo.key, "Mimosa"]]));
    const ribeirao = merged.propriedades.find((p) => p.codigo === "42-900000002");
    const atualizado = ribeirao?.animais.find((animal) => animal.key === alvo.key);

    expect(atualizado?.apelido).toBe("Mimosa");
    expect(atualizado?.brinco).toBe("233768");
    expect(ribeirao?.animais[0]?.apelido).toBe("Mimosa");
    expect(merged.total).toBe(12);
  });

  it("mescla a versão da foto sem duplicar animais", () => {
    const inventory = groupInventories(allParsed());
    const alvo = inventory.propriedades
      .flatMap((property) => property.animais)
      .find((animal) => animal.brinco === "233768");
    if (!alvo) throw new Error("animal ausente");

    const merged = mergeExtras(inventory, new Map(), new Map([[alvo.key, 1700000000000]]));
    const todos = merged.propriedades.flatMap((property) => property.animais);
    const atualizado = todos.find((animal) => animal.key === alvo.key);

    expect(atualizado?.fotoVersao).toBe(1700000000000);
    expect(todos.filter((animal) => animal.fotoVersao !== null)).toHaveLength(1);
    expect(merged.total).toBe(12);
  });
});
