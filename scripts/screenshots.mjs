import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

/**
 * Gera as imagens do README a partir do modo mock.
 *
 * - Usa um banco temporário: nunca lê apelidos ou fotos reais de `data/`.
 * - Sobe a API já compilada em uma porta isolada, com a emissão desligada.
 * - As fixtures são anonimizadas, então nenhuma propriedade real aparece.
 *
 * Pré-requisito: `npm run build`.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const assets = path.join(root, "docs/assets");
const shots = path.join(assets, "screenshots");
const port = Number(process.env.SCREENSHOT_PORT ?? 3199);
const base = `http://127.0.0.1:${port}`;

if (!fs.existsSync(path.join(root, "apps/api/dist/server.js"))) {
  console.error("Compile antes de capturar: npm run build");
  process.exit(1);
}

fs.mkdirSync(shots, { recursive: true });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sigen-shots-"));
const db = path.join(temp, "sigen.db");
const fotos = path.join(temp, "fotos");
const gta = path.join(temp, "gta");

const server = spawn(process.execPath, ["apps/api/dist/server.js"], {
  cwd: root,
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    SIGEN_MOCK: "1",
    GTA_EMISSAO_ATIVA: "0",
    DATABASE_PATH: db,
    PHOTOS_DIR: fotos,
    GTA_DIR: gta,
    LOG_LEVEL: "silent",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout.on("data", (chunk) => {
  serverLog += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverLog += chunk.toString();
});

async function waitForServer() {
  for (let i = 0; i < 100; i += 1) {
    if (server.exitCode !== null) {
      throw new Error(`A API encerrou ao iniciar.\n${serverLog}`);
    }
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {
      // Ainda subindo.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`A API não respondeu em ${base}.\n${serverLog}`);
}

async function loadInventory() {
  const started = await fetch(`${base}/api/inventario`, { method: "POST" });
  const { id } = await started.json();
  for (let i = 0; i < 100; i += 1) {
    const response = await fetch(`${base}/api/inventario/${id}`);
    const job = await response.json();
    if (job.status === "pronto") return job.inventario;
    if (job.status === "erro") throw new Error(job.erro ?? "Falha no inventário");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("O inventário não ficou pronto a tempo.");
}

async function seedNicknames(inventory) {
  const nomes = [
    "Mimosa",
    "Estrela",
    "Trovão",
    "Luna",
    "Bolinha",
    "Serena",
    "Tigre",
    "Manteiga",
  ];
  const animais = inventory.propriedades.flatMap((property) => property.animais);
  for (const [index, animal] of animais.entries()) {
    const apelido = nomes[index % nomes.length];
    await fetch(`${base}/api/nicknames/${encodeURIComponent(animal.key)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apelido }),
    });
  }
}

async function renderPage({ html, width, height, scale = 1, output }) {
  const file = path.join(temp, `${path.basename(output, ".png")}.html`);
  fs.writeFileSync(file, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });
  await page.goto(pathToFileURL(file).href);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: output });
  await browser.close();
  console.log(`  ${path.relative(root, output)}`);
}

async function renderTemplate(name, html, width, height) {
  await renderPage({
    html,
    width,
    height,
    output: path.join(assets, `${name}.png`),
  });
}

function reviewHtml(cardFile) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 390px; height: 844px; overflow: hidden; }
  body {
    background:
      radial-gradient(circle at 12% 0%, rgba(220, 252, 231, .7), transparent 38%),
      radial-gradient(circle at 90% 12%, rgba(254, 243, 199, .55), transparent 42%),
      #f4f1e8;
    display: flex; align-items: center; justify-content: center;
  }
  img { width: 320px; border-radius: 28px; box-shadow: 0 20px 55px rgba(74, 59, 42, .18); }
</style></head><body>
  <img src="${pathToFileURL(cardFile).href}" alt="Revisão da GTA">
</body></html>`;
}

function heroHtml() {
  const inventario = pathToFileURL(path.join(shots, "inventario.png")).href;
  const gtaAnimais = pathToFileURL(path.join(shots, "gta-animais.png")).href;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1600px; height: 900px; overflow: hidden; }
  body {
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #fbf9f3;
    background:
      radial-gradient(circle at 18% 12%, rgba(34, 197, 94, .22), transparent 38%),
      radial-gradient(circle at 88% 84%, rgba(251, 191, 36, .14), transparent 42%),
      #0f3d22;
    display: flex; align-items: center; gap: 40px; padding: 64px 72px;
    position: relative;
  }
  .grain { position: absolute; inset: 0; opacity: .08;
    background-image: radial-gradient(#fff 1px, transparent 1px);
    background-size: 26px 26px; }
  .copy { position: relative; width: 600px; flex: 0 0 600px; }
  .brand { display: flex; align-items: center; gap: 18px; margin-bottom: 38px; }
  .brand img { width: 78px; height: 78px; border-radius: 20px; box-shadow: 0 18px 40px rgba(0,0,0,.35); }
  .brand span { font-size: 26px; font-weight: 800; letter-spacing: .01em; color: #dcfce7; }
  h1 { font-size: 78px; line-height: .98; letter-spacing: -.045em; margin: 0 0 26px; font-weight: 900; }
  h1 em { font-style: normal; color: #86efac; }
  p { font-size: 26px; line-height: 1.4; color: #d1fae5; margin: 0 0 34px; max-width: 540px; }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .chip { font-size: 16px; font-weight: 700; padding: 9px 15px; border-radius: 999px;
    border: 1px solid rgba(220,252,231,.24); background: rgba(255,255,255,.06); color: #ecfdf5; }
  .phones { position: relative; flex: 1; height: 760px; }
  .phone { position: absolute; width: 320px; height: 692px; border-radius: 46px;
    background: #111; padding: 10px; box-shadow: 0 40px 80px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.08); }
  .screen { width: 100%; height: 100%; border-radius: 37px; overflow: hidden; background: #f4f1e8; }
  .screen img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .p1 { left: 20px; top: 28px; transform: rotate(-5deg); z-index: 1; }
  .p2 { left: 300px; top: 64px; transform: rotate(3deg); z-index: 2; }
  .notch { position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
    width: 92px; height: 24px; border-radius: 999px; background: #111; z-index: 3; }
</style></head><body>
  <div class="grain"></div>
  <section class="copy">
    <div class="brand"><img src="${pathToFileURL(path.join(root, "apps/web/public/icons/icon-512.png")).href}"><span>SIGEN Campo</span></div>
    <h1>Seu rebanho.<br><em>Sem burocracia.</em></h1>
    <p>Inventário bovino e GTA em um chat simples, feito para o produtor rural usar no celular.</p>
    <div class="chips">
      <span class="chip">PWA instalável</span>
      <span class="chip">Dados do SIGEN+</span>
      <span class="chip">GTA com conferência</span>
    </div>
  </section>
  <div class="phones">
    <div class="phone p1"><div class="notch"></div><div class="screen"><img src="${inventario}"></div></div>
    <div class="phone p2"><div class="notch"></div><div class="screen"><img src="${gtaAnimais}"></div></div>
  </div>
</body></html>`;
}

function socialHtml() {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1280px; height: 640px; overflow: hidden; }
  body {
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    background:
      radial-gradient(circle at 12% 15%, rgba(34,197,94,.25), transparent 40%),
      radial-gradient(circle at 92% 90%, rgba(251,191,36,.16), transparent 45%),
      #0f3d22;
    color: #f0fdf4; padding: 72px 80px; position: relative;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .grain { position: absolute; inset: 0; opacity: .07;
    background-image: radial-gradient(#fff 1px, transparent 1px);
    background-size: 24px 24px; }
  .top { display: flex; align-items: center; gap: 26px; position: relative; }
  .top img { width: 108px; height: 108px; border-radius: 28px; box-shadow: 0 22px 50px rgba(0,0,0,.35); }
  .name { font-size: 62px; font-weight: 900; letter-spacing: -.03em; line-height: 1; }
  .name small { display: block; margin-top: 10px; font-size: 24px; font-weight: 700; letter-spacing: .02em; color: #bbf7d0; }
  h1 { position: relative; margin: 0; font-size: 58px; line-height: 1.08; letter-spacing: -.035em; max-width: 1000px; }
  h1 em { font-style: normal; color: #86efac; }
  .bottom { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  .chips { display: flex; gap: 10px; flex-wrap: wrap; }
  .chip { font-size: 17px; font-weight: 700; padding: 10px 16px; border-radius: 999px;
    border: 1px solid rgba(220,252,231,.24); background: rgba(255,255,255,.06); color: #ecfdf5; }
  .note { font-size: 18px; font-weight: 700; color: #bbf7d0; }
</style></head><body>
  <div class="grain"></div>
  <div class="top">
    <img src="${pathToFileURL(path.join(root, "apps/web/public/icons/icon-512.png")).href}">
    <div class="name">SIGEN Campo<small>rebanho bovino + GTA no celular</small></div>
  </div>
  <h1>O SIGEN+ explicado<br><em>para quem cria gado.</em></h1>
  <div class="bottom">
    <div class="chips">
      <span class="chip">React</span><span class="chip">Fastify</span>
      <span class="chip">Playwright</span><span class="chip">SQLite</span>
      <span class="chip">PWA</span>
    </div>
    <div class="note">Projeto independente · não oficial</div>
  </div>
</body></html>`;
}

async function capture() {
  await waitForServer();
  console.log("API mock pronta; preparando dados de demonstração...");
  const inventory = await loadInventory();
  await seedNicknames(inventory);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: "light",
  });
  const page = await context.newPage();

  // Inventário com apelidos.
  await page.goto(base);
  await page.getByRole("button", { name: "Ver todos os animais" }).first().click();
  await page.getByText("Inventário bovino").waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shots, "inventario.png") });
  console.log("  docs/assets/screenshots/inventario.png");

  // GTA: seleção de animais.
  await page.reload();
  await page.getByRole("button", { name: "Fazer GTA" }).first().click();
  await page.getByText("Marque os animais que vão sair.").waitFor();
  // A lista é agrupada por propriedade. Usa a primeira (Alto da Serra) como
  // origem para que a seleção apareça junto com o topo do cartão.
  const origem = page
    .locator("section", { hasText: "Alto da Serra · UEP 1" })
    .first();
  await origem.locator('input[type="checkbox"]').nth(0).check();
  await origem.locator('input[type="checkbox"]').nth(1).check();
  const gtaCard = page
    .locator("[data-gta-message] div.overflow-hidden.rounded-3xl")
    .last();
  await gtaCard.evaluate((element) =>
    element.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, "gta-animais.png") });
  console.log("  docs/assets/screenshots/gta-animais.png");

  // GTA: CPF, destino, datas e revisão.
  await page.getByRole("button", { name: /Continuar com/ }).click();
  const cpf = page.getByRole("textbox", { name: "CPF ou CNPJ do destino" });
  await cpf.waitFor();
  await cpf.fill("12345678901");
  await cpf.press("Enter");
  await page
    .getByRole("button", { name: /Rio Bonito · UEP 1/ })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Não", exact: true }).click();
  await page.getByText("Trajeto", { exact: true }).waitFor();
  // O cartão é mais alto que o viewport e vive dentro de um scroller. Libera
  // as alturas para o Playwright capturar o cartão inteiro sem tarjas.
  await page.addStyleTag({
    content: `
      header, .safe-bottom { display: none !important; }
      #root > div, main, main > div, [role="log"] {
        height: auto !important;
        max-height: none !important;
        min-height: 0 !important;
        overflow: visible !important;
      }
    `,
  });
  await page.waitForTimeout(300);
  const reviewCard = path.join(temp, "gta-revisao-card.png");
  await gtaCard.screenshot({ path: reviewCard });
  await renderPage({
    html: reviewHtml(reviewCard),
    width: 390,
    height: 844,
    scale: 2,
    output: path.join(shots, "gta-revisao.png"),
  });

  await browser.close();

  console.log("Compondo capa e cartão social...");
  await renderTemplate("hero", heroHtml(), 1600, 900);
  await renderTemplate("social-preview", socialHtml(), 1280, 640);
}

try {
  await capture();
  console.log("Imagens prontas em docs/assets/.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 300));
  fs.rmSync(temp, { recursive: true, force: true });
}
