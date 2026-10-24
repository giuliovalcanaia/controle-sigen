import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { NicknameStore } from "./db.js";
import { mergeNicknames } from "./sigen/inventory.js";
import type { Inventory, SigenError, SigenStatus } from "./sigen/types.js";

export type InventoryService = {
  getInventory(): Promise<Inventory>;
};

export type RouteDeps = {
  inventory: InventoryService;
  nicknames: NicknameStore;
  getStatus(): SigenStatus;
  logout(): Promise<void>;
};

const nicknameSchema = z.object({
  apelido: z.string().trim().max(40),
});

const keySchema = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);

export async function registerRoutes(app: FastifyInstance, deps: RouteDeps) {
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
    }
    return payload;
  });

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/status", async () => ({ sigen: deps.getStatus() }));

  app.get("/api/animals", async (_request, reply) => {
    const inventory = await deps.inventory.getInventory();
    const merged = mergeNicknames(inventory, deps.nicknames.all());
    reply.header("Cache-Control", "no-store");
    return merged;
  });

  app.put<{ Params: { animalKey: string } }>(
    "/api/nicknames/:animalKey",
    async (request, reply) => {
      const key = keySchema.safeParse(request.params.animalKey);
      if (!key.success) {
        return reply.code(400).send({
          code: "DADOS_INVALIDOS",
          message: "Identificador de animal inválido.",
        });
      }

      const body = nicknameSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          code: "DADOS_INVALIDOS",
          message: "O apelido deve ter no máximo 40 caracteres.",
        });
      }

      const apelido = body.data.apelido;
      if (apelido.length === 0) {
        deps.nicknames.remove(key.data);
        return { ok: true, apelido: null };
      }

      deps.nicknames.set(key.data, apelido);
      return { ok: true, apelido };
    },
  );

  app.post("/api/session/logout", async () => {
    await deps.logout();
    return { ok: true };
  });

  app.setErrorHandler((error, request, reply) => {
    const sigenError = error as Partial<SigenError> & { code?: string };
    if (sigenError.code && typeof sigenError.statusCode === "number") {
      request.log.warn(
        { code: sigenError.code, statusCode: sigenError.statusCode },
        sigenError.message,
      );
      return reply.code(sigenError.statusCode).send({
        code: sigenError.code,
        message: sigenError.message,
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      code: "ERRO_INTERNO",
      message: "Não foi possível concluir a operação.",
    });
  });
}
