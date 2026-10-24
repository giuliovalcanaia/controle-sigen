import fs from "node:fs";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { registerRoutes, type RouteDeps } from "./routes.js";

export type BuildAppOptions = {
  webDist: string;
  logger?: boolean;
};

export async function buildApp(
  deps: RouteDeps,
  options: BuildAppOptions,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 4 * 1024,
  });

  await registerRoutes(app, deps);

  const hasWeb = fs.existsSync(path.join(options.webDist, "index.html"));
  if (hasWeb) {
    await app.register(fastifyStatic, {
      root: options.webDist,
      prefix: "/",
      index: ["index.html"],
    });
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({
        code: "NAO_ENCONTRADO",
        message: "Rota não encontrada.",
      });
    }

    if (hasWeb) {
      return reply.sendFile("index.html");
    }

    return reply
      .code(503)
      .type("text/plain; charset=utf-8")
      .send("Interface não compilada. Rode `npm run build` ou use o Vite em desenvolvimento.");
  });

  return app;
}
