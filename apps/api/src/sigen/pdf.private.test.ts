import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInventoryText, pdfToText } from "./pdf.js";

/**
 * Teste de integração contra os PDFs reais, que ficam em fixtures/private
 * (gitignored). Em uma máquina sem esses arquivos, o bloco é ignorado.
 */
const privateDir = fileURLToPath(new URL("../../../../fixtures/private", import.meta.url));
const files = fs.existsSync(privateDir)
  ? fs.readdirSync(privateDir).filter((file) => file.endsWith(".pdf")).sort()
  : [];

const expected = new Map([
  ["42-000165623-uep1.pdf", 4],
  ["42-000261071-uep1.pdf", 3],
  ["42-000261676-uep2.pdf", 0],
  ["42-000311195-uep1.pdf", 5],
]);

describe.skipIf(files.length === 0)("PDFs reais do SIGEN", () => {
  for (const [file, count] of expected) {
    it(`lê ${file}`, async () => {
      if (!files.includes(file)) return;
      const buffer = fs.readFileSync(path.join(privateDir, file));
      const text = await pdfToText(buffer);
      const parsed = parseInventoryText(text);

      expect(parsed.animais).toHaveLength(count);
      expect(parsed.especie).toBe("BOVINO");
      if (count > 0) expect(parsed.totalDeclarado).toBe(count);
    });
  }
});
