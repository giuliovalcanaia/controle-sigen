import { sanitizeErrorMessage } from "@sigen/contracts";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AnimalStore } from "./db.js";
import type { GtaService } from "./gta/service.js";
import {
  firstIssue,
  gtaInputSchema,
  gtaLookupSchema,
  isValidIsoDate,
  todayIso,
} from "./gta/schema.js";
import type { InventoryService } from "./inventory.js";
import { isJpeg, type PhotoStore } from "./photos.js";
import { mergeExtras } from "./sigen/inventory.js";
import type { SigenError, SigenStatus } from "./sigen/types.js";

export type RouteDeps = {
  inventory: InventoryService;
  store: AnimalStore;
  photos: PhotoStore;
  gta: GtaService;
  getStatus(): SigenStatus;
  logout(): Promise<void>;
};

const nicknameSchema = z.object({
  apelido: z.string().trim().max(40),
});

const keySchema = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);

/** O navegador já reduz a foto para 512×512; 1,5 MB é folga de sobra. */
const PHOTO_BODY_LIMIT = 1_500_000;

const CHAVE_INVALIDA = {
  code: "DADOS_INVALIDOS",
  message: "Identificador de animal inválido.",
};

const FORMATO_INVALIDO = {
  code: "FORMATO_INVALIDO",
  message: "Envie uma foto em JPEG.",
};

/** Erros do Fastify que devem chegar ao app em português. */
const FASTIFY_ERRORS: Record<string, { code: string; message: string; statusCode: number }> = {
  FST_ERR_CTP_BODY_TOO_LARGE: {
    code: "FOTO_MUITO_GRANDE",
    message: "A foto é grande demais. Escolha uma imagem menor.",
    statusCode: 413,
  },
  FST_ERR_CTP_INVALID_MEDIA_TYPE: {
    ...FORMATO_INVALIDO,
    statusCode: 415,
  },
};

export async function registerRoutes(app: FastifyInstance, deps: RouteDeps) {
  // A foto sobe como bytes crus: o cliente converte para JPEG antes de enviar.
  app.addContentTypeParser(
    "image/jpeg",
    { parseAs: "buffer", bodyLimit: PHOTO_BODY_LIMIT },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.addHook("onSend", async (request, reply, payload) => {
    // Fotos têm URL versionada e podem ser cacheadas; o resto da API, nunca.
    if (request.url.startsWith("/api/") && !request.url.startsWith("/api/photos/")) {
      reply.header("Cache-Control", "no-store");
    }
    return payload;
  });

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/status", async () => ({ sigen: deps.getStatus() }));

  app.post("/api/inventario", async (_request, reply) => {
    return reply.code(202).send(deps.inventory.start());
  });

  app.get<{ Params: { id: string } }>(
    "/api/inventario/:id",
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return reply.code(400).send({
          code: "DADOS_INVALIDOS",
          message: "Identificador de consulta inválido.",
        });
      }

      const job = deps.inventory.get(id);
      if (!job) {
        return reply.code(404).send({
          code: "NAO_ENCONTRADO",
          message: "Consulta não encontrada.",
        });
      }

      // O inventário precisa dos apelidos e das fotos locais, aplicados
      // depois do parser (o job guarda só o que veio do SIGEN).
      if (!job.inventario) return job;

      return {
        ...job,
        inventario: mergeExtras(
          job.inventario,
          deps.store.nicknames(),
          deps.store.photoVersions(),
        ),
      };
    },
  );

  app.put<{ Params: { animalKey: string } }>(
    "/api/nicknames/:animalKey",
    async (request, reply) => {
      const key = keySchema.safeParse(request.params.animalKey);
      if (!key.success) {
        return reply.code(400).send(CHAVE_INVALIDA);
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
        deps.store.removeNickname(key.data);
        return { ok: true, apelido: null };
      }

      deps.store.setNickname(key.data, apelido);
      return { ok: true, apelido };
    },
  );

  app.get<{ Params: { animalKey: string } }>(
    "/api/photos/:animalKey",
    async (request, reply) => {
      const key = keySchema.safeParse(request.params.animalKey);
      if (!key.success) {
        return reply.code(400).send(CHAVE_INVALIDA);
      }

      const photo = deps.photos.read(key.data);
      if (!photo) {
        return reply.code(404).send({
          code: "FOTO_NAO_ENCONTRADA",
          message: "Este animal ainda não tem foto.",
        });
      }

      // A URL sempre traz ?v=<versão>, então trocar a foto troca a URL.
      return reply
        .header("Content-Type", "image/jpeg")
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .header("X-Content-Type-Options", "nosniff")
        .send(photo.data);
    },
  );

  app.put<{ Params: { animalKey: string } }>(
    "/api/photos/:animalKey",
    { bodyLimit: PHOTO_BODY_LIMIT },
    async (request, reply) => {
      const key = keySchema.safeParse(request.params.animalKey);
      if (!key.success) {
        return reply.code(400).send(CHAVE_INVALIDA);
      }

      if (!Buffer.isBuffer(request.body) || !isJpeg(request.body)) {
        return reply.code(415).send(FORMATO_INVALIDO);
      }

      const fotoVersao = deps.photos.save(key.data, request.body);
      return { ok: true, fotoVersao };
    },
  );

  app.delete<{ Params: { animalKey: string } }>(
    "/api/photos/:animalKey",
    async (request, reply) => {
      const key = keySchema.safeParse(request.params.animalKey);
      if (!key.success) {
        return reply.code(400).send(CHAVE_INVALIDA);
      }

      deps.photos.remove(key.data);
      return { ok: true };
    },
  );

  app.get("/api/gta/opcoes", async () => deps.gta.options());

  const gtaDestinosSchema = gtaLookupSchema.extend({
    dataSaida: z.string().trim().optional(),
  });

  app.post("/api/gta/destinos", async (request, reply) => {
    const body = gtaDestinosSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        code: "DADOS_INVALIDOS",
        message: firstIssue(body.error),
      });
    }

    const dataSaida =
      body.data.dataSaida && isValidIsoDate(body.data.dataSaida)
        ? body.data.dataSaida
        : todayIso();
    const ueps = await deps.gta.lookupDestinos(body.data.cpf, dataSaida);
    return { ueps };
  });

  const gtaStartSchema = z.object({
    gta: gtaInputSchema,
    modo: z.enum(["conferir", "emitir"]).default("emitir"),
  });

  app.post("/api/gta", async (request, reply) => {
    const body = gtaStartSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        code: "DADOS_INVALIDOS",
        message: firstIssue(body.error),
      });
    }

    const result = await deps.gta.start({
      input: body.data.gta,
      modo: body.data.modo,
    });
    return reply.code(202).send(result);
  });

  const gtaConferenciaSchema = z.object({
    resultado: z.enum(["emitida", "nao_emitida"]),
    numero: z.string().trim().max(30).optional(),
  });

  app.post<{ Params: { id: string } }>(
    "/api/gta/:id/conferencia",
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return reply.code(400).send({
          code: "DADOS_INVALIDOS",
          message: "Identificador de GTA inválido.",
        });
      }

      const body = gtaConferenciaSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          code: "DADOS_INVALIDOS",
          message: firstIssue(body.error),
        });
      }

      return deps.gta.resolver(
        id,
        body.data.resultado,
        body.data.numero,
      );
    },
  );

  app.get("/api/gta", async () => ({ gtas: deps.gta.list(20) }));

  app.get<{ Params: { id: string } }>("/api/gta/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({
        code: "DADOS_INVALIDOS",
        message: "Identificador de GTA inválido.",
      });
    }

    const job = deps.gta.get(id);
    if (!job) {
      return reply.code(404).send({
        code: "NAO_ENCONTRADO",
        message: "Emissão de GTA não encontrada.",
      });
    }
    return job;
  });

  app.get<{ Params: { id: string } }>(
    "/api/gta/:id/pdf",
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return reply.code(400).send({
          code: "DADOS_INVALIDOS",
          message: "Identificador de GTA inválido.",
        });
      }

      const pdf = deps.gta.pdf(id);
      if (!pdf) {
        return reply.code(404).send({
          code: "PDF_NAO_ENCONTRADO",
          message: "O PDF desta GTA não está disponível.",
        });
      }

      return reply
        .header("Content-Type", "application/pdf")
        .header("Cache-Control", "private, no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Disposition", `inline; filename="gta-${id}.pdf"`)
        .send(pdf);
    },
  );

  app.post("/api/session/logout", async () => {
    await deps.logout();
    return { ok: true };
  });

  app.setErrorHandler((error, request, reply) => {
    const failure = error as { code?: string; message?: string };
    const mapped = failure.code ? FASTIFY_ERRORS[failure.code] : undefined;
    if (mapped) {
      request.log.warn({ code: failure.code }, failure.message);
      return reply.code(mapped.statusCode).send({
        code: mapped.code,
        message: mapped.message,
      });
    }

    const sigenError = error as Partial<SigenError> & { code?: string };
    if (sigenError.code && typeof sigenError.statusCode === "number") {
      const message = sanitizeErrorMessage(sigenError.message ?? "");
      request.log.warn(
        { code: sigenError.code, statusCode: sigenError.statusCode },
        message,
      );
      return reply.code(sigenError.statusCode).send({
        code: sigenError.code,
        message,
        ...(sigenError.detalhe ? { detalhe: sigenError.detalhe } : {}),
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      code: "ERRO_INTERNO",
      message: "Não foi possível concluir a operação.",
    });
  });
}
