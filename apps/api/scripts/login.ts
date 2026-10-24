import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { config } from "../src/config.js";

const statePath = config.sigen.storageState || path.join(config.rootDir, ".auth/state.json");
const uepPath = path.join(config.rootDir, "fixtures/private/ueps.json");

fs.mkdirSync(path.dirname(statePath), { recursive: true });
fs.mkdirSync(path.dirname(uepPath), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ locale: "pt-BR" });
const page = await context.newPage();

console.log("\nAbrindo o SIGEN. Faça login no navegador; o script detecta sozinho.");
console.log("A senha não é lida nem gravada pelo script.\n");

await page.goto(`${config.sigen.baseUrl}/Account/LogOn`, {
  waitUntil: "domcontentloaded",
});

try {
  await page.waitForURL(
    (url) => !url.pathname.toLowerCase().includes("/account/logon"),
    { timeout: 5 * 60_000 },
  );
} catch {
  console.error("Tempo esgotado esperando o login. Nada foi salvo.");
  await browser.close();
  process.exit(1);
}

await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);

// Guarda apenas cookies/localStorage da sessão. Não contém a senha.
await context.storageState({ path: statePath });
console.log(`Sessão salva em ${path.relative(config.rootDir, statePath)}`);

try {
  const response = await context.request.get(
    `${config.sigen.baseUrl}/DSA.Cadastros/UnidadeExploracao/VerificarPermissaoImprimirInventarioHome`,
    { headers: { Accept: "application/json" }, timeout: 30_000 },
  );
  if (response.ok()) {
    const body = await response.json();
    fs.writeFileSync(uepPath, JSON.stringify(body, null, 2));
    console.log(
      `Resposta das UEPs salva em ${path.relative(config.rootDir, uepPath)} (dados privados, gitignored).`,
    );
  } else {
    console.warn(`O SIGEN respondeu ${response.status()} ao listar as UEPs.`);
  }
} catch (error) {
  console.warn("Não consegui salvar a lista de UEPs:", error instanceof Error ? error.message : error);
}

await browser.close();
console.log("\nPronto. Agora você pode rodar `npm run sigen:check` ou subir a API.");
