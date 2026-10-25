import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { openAnimalStore, type AnimalStore } from "./db.js";
import { openPhotoStore, type PhotoStore } from "./photos.js";
import { getMockInventory } from "./sigen/mock.js";

const ANIMAL_KEY = "076000003067836";

let app: Awaited<ReturnType<typeof buildApp>> | null = null;
let store: AnimalStore | null = null;
let photos: PhotoStore | null = null;
let photosDir = "";

/** Basta o cabeçalho JPEG (FF D8 FF) para o validador aceitar. */
function jpeg(extra = 64): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(extra, 0x11)]);
}

async function setup() {
  photosDir = fs.mkdtempSync(path.join(os.tmpdir(), "sigen-fotos-"));
  store = openAnimalStore(":memory:");
  photos = openPhotoStore(photosDir, store);
  app = await buildApp(
    {
      inventory: { getInventory: async () => getMockInventory() },
      store,
      photos,
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
  fs.rmSync(photosDir, { recursive: true, force: true });
  app = null;
  store = null;
  photos = null;
  photosDir = "";
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

    const animais = body.propriedades.flatMap(
      (property: { animais: Array<{ fotoVersao: number | null }> }) => property.animais,
    );
    expect(animais.every((animal: { fotoVersao: number | null }) => animal.fotoVersao === null)).toBe(
      true,
    );
  });

  it("grava, retorna e remove apelido", async () => {
    const server = await setup();

    const saved = await server.inject({
      method: "PUT",
      url: `/api/nicknames/${ANIMAL_KEY}`,
      payload: { apelido: "Mimosa" },
    });
    expect(saved.statusCode).toBe(200);

    const list = await server.inject({ method: "GET", url: "/api/animals" });
    const animals = list
      .json()
      .propriedades.flatMap((property: { animais: Array<{ key: string; apelido: string | null }> }) => property.animais);
    expect(animals.find((animal: { key: string }) => animal.key === ANIMAL_KEY).apelido).toBe(
      "Mimosa",
    );

    const removed = await server.inject({
      method: "PUT",
      url: `/api/nicknames/${ANIMAL_KEY}`,
      payload: { apelido: "" },
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().apelido).toBeNull();
  });

  it("recusa apelido longo e chave inválida", async () => {
    const server = await setup();

    const long = await server.inject({
      method: "PUT",
      url: `/api/nicknames/${ANIMAL_KEY}`,
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

  it("grava, serve e remove a foto do animal", async () => {
    const server = await setup();
    const image = jpeg();

    const saved = await server.inject({
      method: "PUT",
      url: `/api/photos/${ANIMAL_KEY}`,
      payload: image,
      headers: { "content-type": "image/jpeg" },
    });
    expect(saved.statusCode).toBe(200);
    const { fotoVersao } = saved.json();
    expect(typeof fotoVersao).toBe("number");

    const got = await server.inject({ method: "GET", url: `/api/photos/${ANIMAL_KEY}` });
    expect(got.statusCode).toBe(200);
    expect(got.headers["content-type"]).toBe("image/jpeg");
    expect(got.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(got.rawPayload.equals(image)).toBe(true);

    const list = await server.inject({ method: "GET", url: "/api/animals" });
    const animal = list
      .json()
      .propriedades.flatMap((property: { animais: Array<{ key: string; fotoVersao: number | null }> }) => property.animais)
      .find((item: { key: string }) => item.key === ANIMAL_KEY);
    expect(animal.fotoVersao).toBe(fotoVersao);

    const removed = await server.inject({
      method: "DELETE",
      url: `/api/photos/${ANIMAL_KEY}`,
    });
    expect(removed.statusCode).toBe(200);

    const after = await server.inject({ method: "GET", url: `/api/photos/${ANIMAL_KEY}` });
    expect(after.statusCode).toBe(404);
    expect(after.json().code).toBe("FOTO_NAO_ENCONTRADA");
  });

  it("recusa conteúdo que não seja JPEG", async () => {
    const server = await setup();

    const texto = await server.inject({
      method: "PUT",
      url: `/api/photos/${ANIMAL_KEY}`,
      payload: Buffer.from("isto não é uma foto"),
      headers: { "content-type": "image/jpeg" },
    });
    expect(texto.statusCode).toBe(415);
    expect(texto.json().code).toBe("FORMATO_INVALIDO");

    const json = await server.inject({
      method: "PUT",
      url: `/api/photos/${ANIMAL_KEY}`,
      payload: { foto: "x" },
    });
    expect(json.statusCode).toBe(415);
    expect(json.json().code).toBe("FORMATO_INVALIDO");
  });

  it("recusa foto acima do limite", async () => {
    const server = await setup();

    const response = await server.inject({
      method: "PUT",
      url: `/api/photos/${ANIMAL_KEY}`,
      payload: jpeg(1_600_000),
      headers: { "content-type": "image/jpeg" },
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().code).toBe("FOTO_MUITO_GRANDE");
  });

  it("recusa chave inválida nas rotas de foto", async () => {
    const server = await setup();

    for (const method of ["GET", "PUT", "DELETE"] as const) {
      const response = await server.inject({
        method,
        url: "/api/photos/chave_invalida",
        ...(method === "PUT"
          ? { payload: jpeg(), headers: { "content-type": "image/jpeg" } }
          : {}),
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("DADOS_INVALIDOS");
    }
  });

  it("não encontra rotas de API desconhecidas", async () => {
    const server = await setup();
    const response = await server.inject({ method: "GET", url: "/api/nao-existe" });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NAO_ENCONTRADO");
  });
});
