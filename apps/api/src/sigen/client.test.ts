import { describe, expect, it } from "vitest";
import type { BrowserContext } from "playwright";
import { SigenClient } from "./client.js";
import type { SigenSession } from "./session.js";

type PostOptions = {
  data?: Record<string, unknown>;
  form?: Record<string, unknown>;
};

function clientWith(
  response: Record<string, unknown>,
  captured: PostOptions[] = [],
): SigenClient {
  const context = {
    request: {
      post: async (_url: string, options: PostOptions) => {
        captured.push(options);
        return {
          status: () => 200,
          ok: () => true,
          headers: () => ({ "content-type": "application/json" }),
          json: async () => response,
        };
      },
    },
  } as unknown as BrowserContext;

  const session = {
    withContext: async <T>(fn: (ctx: BrowserContext) => Promise<T>) => fn(context),
  } as unknown as SigenSession;

  return new SigenClient(session, "https://sigen.example");
}

describe("QuickSearch de destinos", () => {
  it("envia o JSON que a tela de GTA usa, não o formulário antigo", async () => {
    const captured: PostOptions[] = [];
    const client = clientWith({ success: true, data: [] }, captured);

    await client.quickSearchUeps("12345678901", "2026-11-17");

    expect(captured).toHaveLength(1);
    expect(captured[0]?.form).toBeUndefined();
    expect(captured[0]?.data).toMatchObject({
      fitroHabilitacao: "True",
      filtroEvento: "True",
      tipoPropriedade: "TR",
      dtSaida: "2026-11-17T00:00:00",
      paramTipoGta: "NO",
      query: "12345678901",
    });
  });

  it("converte só os bovinos e monta o código oficial", async () => {
    const client = clientWith({
      success: true,
      data: [
        {
          id_unidade_exploracao: 75530,
          cd_oficial: "77026",
          nr_codigo_IBGE: "42",
          nr_unidade_exploracao: "1",
          nm_especie_animal: "BOVINO",
          sg_uf: "SC",
          nm_localidade: "Localidade",
          nm_municipio: "Município",
          nm_pessoa: "Produtor",
        },
        {
          id_unidade_exploracao: 273062,
          cd_oficial: "77026",
          nr_codigo_IBGE: "42",
          nr_unidade_exploracao: "2",
          nm_especie_animal: "GALINHA",
          sg_uf: "SC",
        },
      ],
    });

    const ueps = await client.quickSearchUeps("12345678901", "2026-11-17");

    expect(ueps).toEqual([
      {
        id: "75530",
        codigoOficial: "42-000077026",
        uep: "1",
        localidade: "Localidade",
        municipio: "Município",
        uf: "SC",
        especie: "BOVINO",
        produtor: "Produtor",
      },
    ]);
  });
});
