import { buildApp } from "./app.js";
import { config } from "./config.js";
import { openAnimalStore } from "./db.js";
import { createMockGtaService } from "./gta/mock.js";
import { openGtaPdfStore } from "./gta/pdf.js";
import { createGtaService, type GtaService } from "./gta/service.js";
import { openPhotoStore } from "./photos.js";
import type { InventoryService } from "./routes.js";
import { SigenClient } from "./sigen/client.js";
import { getMockInventory } from "./sigen/mock.js";
import { SigenSession } from "./sigen/session.js";
import type { SigenStatus } from "./sigen/types.js";

const store = openAnimalStore(config.databasePath);
const photos = openPhotoStore(config.photosDir, store);
const gtaPdfs = openGtaPdfStore(config.gtaDir);

let session: SigenSession | null = null;
let inventory: InventoryService;
let gta: GtaService;
let getStatus: () => SigenStatus;
let logout: () => Promise<void>;

if (config.mock) {
  inventory = { getInventory: async () => getMockInventory() };
  gta = createMockGtaService(store);
  getStatus = () => ({ state: "active", expiresInSeconds: 0 });
  logout = async () => undefined;
} else {
  const activeSession = new SigenSession(config.sigen);
  session = activeSession;
  const client = new SigenClient(activeSession, config.sigen.baseUrl);
  inventory = { getInventory: () => client.getInventory() };
  gta = createGtaService({
    client,
    session: activeSession,
    store,
    pdfs: gtaPdfs,
    baseUrl: config.sigen.baseUrl,
    emissaoAtiva: config.gta.emissaoAtiva,
  });
  getStatus = () => activeSession.getStatus();
  logout = () => activeSession.logout();
}

const app = await buildApp(
  { inventory, store, photos, gta, getStatus, logout },
  { webDist: config.webDist },
);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "Encerrando");
  await app.close().catch(() => undefined);
  await session?.close().catch(() => undefined);
  store.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(
    { mock: config.mock, url: `http://${config.host}:${config.port}` },
    "SIGEN Campo iniciado",
  );
} catch (error) {
  app.log.error(error);
  store.close();
  process.exit(1);
}
