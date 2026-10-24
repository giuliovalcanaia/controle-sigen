import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { openNicknameStore, type NicknameStore } from "./db.js";
import { getMockInventory } from "./sigen/mock.js";

let app: Awaited<ReturnType<typeof buildApp>> | null = null;
let store: NicknameStore | null = null;

async function setup() {
  store = openNicknameStore(":memory:");
  app = await buildApp(
    {
      inventory: { getInventory: async () => getMockInventory() },
      nicknames: store,
      getStatus: () => ({ state: "active", expiresInSeconds: 0 }),
      logout: async () => undefined,
    },
    { webDist: "/caminho/que-nao-existe", logger: false },
  );
  return app;
}

afterEach(async () => {
  await app?.close();
  store?.close();
  app = null;
  store = null;
});

describe("API", () => {
  it("devolve o inventário com as quatro propriedades", async () => {
    const server = await setup();
    const response = await server.inject({ method: "GET", url: "/api/animals" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json();
    expect(body.total).toBe(12);
    expect(body.propriedades).toHaveLength(4);
    expect(body.propriedades.find((p: { codigo: string }) => p.codigo === "42-000261676").animais).toHaveLength(0);
  });

  it("grava, retorna e remove apelido", async () => {
    const server = await setup();

    const saved = await server.inject({
      method: "PUT",
      url: "/api/nicknames/076000003067836",
      payload: { apelido: "Mimosa" },
    });
    expect(saved.statusCode).toBe(200);

    const list = await server.inject({ method: "GET", url: "/api/animals" });
    const animals = list
      .json()
      .propriedades.flatMap((property: { animais: Array<{ key: string; apelido: string | null }> }) => property.animais);
    expect(animals.find((animal: { key: string }) => animal.key === "076000003067836").apelido).toBe(
      "Mimosa",
    );

    const removed = await server.inject({
      method: "PUT",
      url: "/api/nicknames/076000003067836",
      payload: { apelido: "" },
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().apelido).toBeNull();
  });

  it("recusa apelido longo e chave inválida", async () => {
    const server = await setup();

    const long = await server.inject({
      method: "PUT",
      url: "/api/nicknames/076000003067836",
      payload: { apelido: "x".repeat(41) },
    });
    expect(long.statusCode).toBe(400);

    const key = await server.inject({
      method: "PUT",
      url: "/api/nicknames/chave_invalida",
      payload: { apelido: "x" },
    });
    expect(key.statusCode).toBe(400);
  });

  it("não encontra rotas de API desconhecidas", async () => {
    const server = await setup();
    const response = await server.inject({ method: "GET", url: "/api/nao-existe" });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NAO_ENCONTRADO");
  });
});
