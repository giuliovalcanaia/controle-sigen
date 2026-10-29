import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInventoryText, pdfToText } from "./pdf.js";

/**
 * Teste de integração contra os PDFs reais, que ficam em fixtures/private
 * (gitignored). Em uma máquina sem esses arquivos, o bloco é ignorado.
 *
 * Os nomes e as contagens não ficam no código: assim o teste não publica
 * códigos de UEP nem a quantidade de animais de nenhuma propriedade.
 */
const privateDir = fileURLToPath(new URL("../../../../fixtures/private", import.meta.url));
const files = fs.existsSync(privateDir)
  ? fs.readdirSync(privateDir).filter((file) => file.endsWith(".pdf")).sort()
  : [];

describe.skipIf(files.length === 0)("PDFs reais do SIGEN", () => {
  for (const file of files) {
    it(`lê ${file}`, async () => {
      const buffer = fs.readFileSync(path.join(privateDir, file));
      const text = await pdfToText(buffer);
      const parsed = parseInventoryText(text);

      expect(parsed.especie).toBe("BOVINO");
      if (parsed.totalDeclarado !== null) {
        expect(parsed.animais).toHaveLength(parsed.totalDeclarado);
      }
    });
  }
});
