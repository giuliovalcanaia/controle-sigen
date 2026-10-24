import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";
import { SigenSession } from "../src/sigen/session.js";

/**
 * Diagnóstico da resposta de UEPs. Não imprime nomes, CPF nem endereço:
 * apenas a estrutura, os IDs e os valores que parecem espécie.
 */
const SPECIES = /BOVINO|SUINO|AVES|EQUINO|CAPRINO|OVINO|BUFALINO|APICOLA|AQUICULTURA|PISCICULTURA/i;

function speciesValues(value: unknown, depth = 0): string[] {
  if (depth > 3 || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => speciesValues(item, depth + 1));
  }

  const found: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (typeof child === "string" && SPECIES.test(child)) found.push(`${key}=${child}`);
    else if (typeof child === "number" && SPECIES.test(key)) found.push(`${key}=${child}`);
    else if (child && typeof child === "object" && !key.toLowerCase().includes("propriedade")) {
      found.push(...speciesValues(child, depth + 1));
    }
  }
  return found;
}

const session = new SigenSession(config.sigen);
const output = path.join(config.rootDir, "fixtures/private/ueps.json");

try {
  await session.withContext(async (context) => {
    const response = await context.request.get(
      `${config.sigen.baseUrl}/DSA.Cadastros/UnidadeExploracao/VerificarPermissaoImprimirInventarioHome`,
      {
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${config.sigen.baseUrl}/`,
        },
        timeout: 30_000,
      },
    );

    if (!response.ok()) {
      throw new Error(`SIGEN respondeu ${response.status()}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(body, null, 2));

    console.log("Chaves de topo:", Object.keys(body).join(", "));

    const seen = new WeakSet<object>();
    const walk = (value: unknown) => {
      if (value === null || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }

      const record = value as Record<string, unknown>;
      if ("idUnidadeExploracao" in record) {
        console.log(
          `UEP ${String(record.idUnidadeExploracao)} | chaves: ${Object.keys(record).join(", ")} | espécie: ${
            speciesValues(record).join(", ") || "?"
          }`,
        );
      }

      for (const child of Object.values(record)) walk(child);
    };
    walk(body);

    console.log(`Resposta salva em ${path.relative(config.rootDir, output)} (gitignored).`);
  });
} finally {
  await session.close();
}
