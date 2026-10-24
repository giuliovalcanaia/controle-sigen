import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { groupInventories } from "./inventory.js";
import { parseInventoryText } from "./pdf.js";
import type { Inventory } from "./types.js";

const fixturesDir = fileURLToPath(new URL("../../../../fixtures/inventory", import.meta.url));

/**
 * Inventário de demonstração, montado a partir das fixtures sanitizadas.
 * Usado com SIGEN_MOCK=1 para desenvolver a interface sem credenciais.
 */
export function getMockInventory(): Inventory {
  const dir = fs.existsSync(fixturesDir) ? fixturesDir : path.join(config.rootDir, "fixtures/inventory");
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".txt"))
    .sort();

  if (files.length === 0) {
    throw new Error(`Nenhuma fixture encontrada em ${dir}`);
  }

  const parsed = files.map((file) =>
    parseInventoryText(fs.readFileSync(path.join(dir, file), "utf8")),
  );

  const inventory = groupInventories(parsed);
  return { ...inventory, buscadoEm: new Date().toISOString() };
}
