import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseInventoryText } from "./pdf.js";
import { SigenError } from "./types.js";

const fixturesDir = fileURLToPath(new URL("../../../../fixtures/inventory", import.meta.url));

function fixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), "utf8");
}

describe("parseInventoryText", () => {
  it("lê a propriedade de Capivari com 4 animais", () => {
    const parsed = parseInventoryText(fixture("42-000165623-uep1.txt"));

    expect(parsed.codigoOficial).toBe("42-000165623");
    expect(parsed.uep).toBe("1");
    expect(parsed.especie).toBe("BOVINO");
    expect(parsed.localidade).toBe("Capivari");
    expect(parsed.municipio).toBe("Doutor Pedrinho");
    expect(parsed.uf).toBe("SC");
    expect(parsed.totalDeclarado).toBe(4);
    expect(parsed.animais).toHaveLength(4);

    expect(parsed.animais[0]).toMatchObject({
      brinco: "067836",
      brincoOficial: "076000003067836",
      key: "076000003067836",
      sexo: "Fêmea",
      idade: { anos: 0, meses: 8 },
      nascimento: "17/02/2026",
      apelido: null,
    });
  });

  it("preserva zeros à esquerda no brinco de manejo", () => {
    const parsed = parseInventoryText(fixture("42-000165623-uep1.txt"));
    const animais = parsed.animais.map((animal) => animal.brinco);
    expect(animais).toContain("067836");
    expect(animais).toContain("069054");
    expect(animais).not.toContain("67836");
  });

  it("lê a propriedade de Ribeirão Rigo com 3 animais", () => {
    const parsed = parseInventoryText(fixture("42-000261071-uep1.txt"));
    expect(parsed.codigoOficial).toBe("42-000261071");
    expect(parsed.totalDeclarado).toBe(3);
    expect(parsed.animais).toHaveLength(3);
  });

  it("lê a propriedade de Coqueiral com 5 animais", () => {
    const parsed = parseInventoryText(fixture("42-000311195-uep1.txt"));
    expect(parsed.codigoOficial).toBe("42-000311195");
    expect(parsed.totalDeclarado).toBe(5);
    expect(parsed.animais).toHaveLength(5);
  });

  it("trata unidade sem saldo animal como zero animais", () => {
    const parsed = parseInventoryText(fixture("42-000261676-uep2.txt"));
    expect(parsed.codigoOficial).toBe("42-000261676");
    expect(parsed.uep).toBe("2");
    expect(parsed.totalDeclarado).toBeNull();
    expect(parsed.animais).toHaveLength(0);
  });

  it("falha quando a quantidade encontrada difere do total declarado", () => {
    const original = fixture("42-000261071-uep1.txt");
    const extraRow =
      "                                                                   076000009999999                    999999                          Fêmea                     1              1                 01/01/2025";
    const altered = original.replace("Total Geral", `${extraRow}\n\nTotal Geral`);

    expect(() => parseInventoryText(altered)).toThrowError(
      /declara 3 animal\(is\), mas o parser encontrou 4/,
    );
  });

  it("falha quando o cabeçalho some", () => {
    const original = fixture("42-000261071-uep1.txt");
    const altered = original.replace(/Código Oficial:\s*42-000261071/, "");

    expect(() => parseInventoryText(altered)).toThrowError(SigenError);
    try {
      parseInventoryText(altered);
    } catch (error) {
      expect((error as SigenError).code).toBe("PDF_LAYOUT_MUDOU");
    }
  });

  it("não descarta espécies diferentes; apenas informa qual é", () => {
    const original = fixture("42-000261071-uep1.txt");
    const altered = original.replace("Espécie: BOVINO", "Espécie: SUINO");
    const parsed = parseInventoryText(altered);
    expect(parsed.especie).toBe("SUINO");
  });
});
