import { buildApp } from "./app.js";
import { config } from "./config.js";
import { openAnimalStore } from "./db.js";
import { openPhotoStore } from "./photos.js";
import type { InventoryService } from "./routes.js";
import { SigenClient } from "./sigen/client.js";
import { getMockInventory } from "./sigen/mock.js";
import { SigenSession } from "./sigen/session.js";
import type { SigenStatus } from "./sigen/types.js";

const store = openAnimalStore(config.databasePath);
const photos = openPhotoStore(config.photosDir, store);

let session: SigenSession | null = null;
let inventory: InventoryService;
let getStatus: () => SigenStatus;
let logout: () => Promise<void>;

if (config.mock) {
  inventory = { getInventory: async () => getMockInventory() };
  getStatus = () => ({ state: "active", expiresInSeconds: 0 });
  logout = async () => undefined;
} else {
  session = new SigenSession(config.sigen);
  const client = new SigenClient(session, config.sigen.baseUrl);
  inventory = { getInventory: () => client.getInventory() };
  getStatus = () => session!.getStatus();
  logout = () => session!.logout();
}

const app = await buildApp(
  { inventory, store, photos, getStatus, logout },
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
