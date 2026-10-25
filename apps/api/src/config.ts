import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../../..", import.meta.url));

/** Carrega .env da raiz sem depender de dotenv. */
try {
  process.loadEnvFile(path.join(rootDir, ".env"));
} catch {
  // .env é opcional.
}

function bool(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function resolveFromRoot(value: string): string {
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

const databasePath =
  process.env.DATABASE_PATH === ":memory:"
    ? ":memory:"
    : resolveFromRoot(process.env.DATABASE_PATH ?? "data/sigen.db");

/** Fotos ficam ao lado do SQLite, dentro do mesmo volume `data`. */
const photosDir = process.env.PHOTOS_DIR
  ? resolveFromRoot(process.env.PHOTOS_DIR)
  : path.join(
      databasePath === ":memory:" ? path.join(rootDir, "data") : path.dirname(databasePath),
      "fotos",
    );

/** PDFs das GTAs ficam ao lado do SQLite, no mesmo volume `data`. */
const gtaDir = process.env.GTA_DIR
  ? resolveFromRoot(process.env.GTA_DIR)
  : path.join(
      databasePath === ":memory:" ? path.join(rootDir, "data") : path.dirname(databasePath),
      "gta",
    );

export const config = {
  rootDir,
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  databasePath,
  photosDir,
  gtaDir,
  webDist: path.join(rootDir, "apps/web/dist"),
  fixturesDir: path.join(rootDir, "fixtures/inventory"),
  mock: bool(process.env.SIGEN_MOCK),
  gta: {
    /** Enquanto falso, o app só confere a GTA e nunca salva. */
    emissaoAtiva: bool(process.env.GTA_EMISSAO_ATIVA),
  },
  sigen: {
    baseUrl: (process.env.SIGEN_BASE_URL ?? "https://sigen.cidasc.sc.gov.br").replace(/\/+$/, ""),
    usuario: process.env.SIGEN_USUARIO ?? "",
    senha: process.env.SIGEN_SENHA ?? "",
    storageState: process.env.SIGEN_STORAGE_STATE
      ? resolveFromRoot(process.env.SIGEN_STORAGE_STATE)
      : "",
    idleMinutes: Math.max(1, Number(process.env.SIGEN_IDLE_MINUTES ?? 20)),
  },
};

export type AppConfig = typeof config;

export function storageStateExists(filename: string): boolean {
  return Boolean(filename) && fs.existsSync(filename);
}
