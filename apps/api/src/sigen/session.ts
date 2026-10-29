import fs from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { SigenError, type SigenStatus } from "./types.js";

export type SigenSessionConfig = {
  baseUrl: string;
  usuario: string;
  senha: string;
  storageState: string;
  idleMinutes: number;
};

type State = SigenStatus["state"];

class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn, fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

const UEP_LIST_PATH =
  "/DSA.Cadastros/UnidadeExploracao/VerificarPermissaoImprimirInventarioHome";
const LOGOUT_PATH = "/Account/LogOut";

/**
 * Mantém uma única sessão do SIGEN.
 *
 * - Login preguiçoso: só acontece na primeira requisição de dados.
 * - 20 minutos de ociosidade (configurável) encerram a sessão.
 * - Um mutex serializa tudo: duas requisições simultâneas não abrem dois
 *   logins, o que invalidaria a sessão uma da outra.
 */
export class SigenSession {
  private readonly config: SigenSessionConfig;
  private readonly mutex = new Mutex();
  private readonly idleMs: number;

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private state: State = "logged_out";
  private loginPromise: Promise<void> | null = null;
  private lastActivity = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(config: SigenSessionConfig) {
    this.config = config;
    this.idleMs = config.idleMinutes * 60_000;
  }

  getStatus(): SigenStatus {
    const remaining =
      this.state === "active"
        ? Math.max(0, this.idleMs - (Date.now() - this.lastActivity))
        : 0;
    return {
      state: this.state,
      expiresInSeconds: Math.round(remaining / 1000),
    };
  }

  async withContext<T>(fn: (context: BrowserContext) => Promise<T>): Promise<T> {
    return this.mutex.run(async () => {
      await this.ensureLoggedIn();
      this.touch();

      try {
        return await fn(this.context!);
      } catch (error) {
        if (error instanceof SigenError && error.code === "SESSAO_EXPIRADA") {
          await this.resetContext();
          await this.ensureLoggedIn();
          this.touch();
          return await fn(this.context!);
        }
        throw error;
      } finally {
        this.touch();
      }
    });
  }

  /**
   * Igual a `withContext`, mas entrega a página e **nunca repete** a função.
   *
   * A emissão de GTA é uma escrita: se a sessão cair depois do clique em
   * Salvar, repetir a função poderia emitir duas GTAs. Quem chama decide o
   * que fazer com o erro.
   */
  async withWritePage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    return this.mutex.run(async () => {
      await this.ensureLoggedIn();
      this.touch();

      try {
        const page = await this.ensurePage();
        return await fn(page);
      } finally {
        this.touch();
      }
    });
  }

  async logout(): Promise<void> {
    await this.mutex.run(async () => {
      await this.closeContext(true);
    });
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.mutex.run(async () => {
      await this.closeContext(false);
      if (this.browser) {
        await this.browser.close().catch(() => undefined);
        this.browser = null;
      }
    });
  }

  private touch(): void {
    this.lastActivity = Date.now();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.logoutIfIdle();
    }, this.idleMs);
    this.timer.unref();
  }

  private async logoutIfIdle(): Promise<void> {
    // A checagem acontece dentro do mutex: se uma requisição estava em
    // andamento, `lastActivity` já foi atualizado e não devemos derrubar a
    // sessão de quem acabou de usar o app.
    await this.mutex.run(async () => {
      if (this.state !== "active") return;
      if (Date.now() - this.lastActivity < this.idleMs) return;
      await this.closeContext(true);
    });
  }

  private async ensurePage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) return this.page;
    if (!this.context) {
      throw new SigenError("SESSAO_EXPIRADA", "A sessão do SIGEN expirou.");
    }
    this.page = await this.context.newPage();
    return this.page;
  }

  private async getBrowser(): Promise<Browser> {    if (this.browser?.isConnected()) return this.browser;
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ["--disable-dev-shm-usage"],
      });
      return this.browser;
    } catch (error) {
      throw new SigenError(
        "SIGEN_ERRO",
        `Não foi possível abrir o Chromium. Rode "npx playwright install chromium". ${
          error instanceof Error ? error.message : ""
        }`.trim(),
      );
    }
  }

  private async ensureLoggedIn(): Promise<void> {
    if (this.state === "active" && this.context) return;
    if (this.loginPromise) return this.loginPromise;

    this.state = "logging_in";
    this.loginPromise = this.doLogin().finally(() => {
      this.loginPromise = null;
    });

    try {
      await this.loginPromise;
      this.state = "active";
      this.touch();
    } catch (error) {
      this.state = "logged_out";
      throw error;
    }
  }

  private async doLogin(): Promise<void> {
    const browser = await this.getBrowser();
    await this.resetContext();

    const hasStateFile = Boolean(this.config.storageState) && fs.existsSync(this.config.storageState);
    const context = await browser.newContext({
      acceptDownloads: true,
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      ...(hasStateFile ? { storageState: this.config.storageState } : {}),
    });
    context.setDefaultTimeout(30_000);
    context.setDefaultNavigationTimeout(30_000);

    const page = await context.newPage();

    // A sessão salva por `npm run sigen:login` evita guardar a senha no dev.
    if (hasStateFile && (await this.checkSession(context))) {
      this.context = context;
      this.page = page;
      this.touch();
      return;
    }

    if (!this.config.usuario || !this.config.senha) {
      await context.close().catch(() => undefined);
      throw new SigenError(
        "SEM_CREDENCIAIS",
        hasStateFile
          ? "A sessão salva do SIGEN expirou. Rode `npm run sigen:login` novamente ou configure SIGEN_USUARIO e SIGEN_SENHA."
          : "Configure SIGEN_USUARIO e SIGEN_SENHA, ou rode `npm run sigen:login` para salvar uma sessão.",
        503,
      );
    }

    try {
      await this.loginWithCredentials(page);
      if (!(await this.checkSession(context))) {
        throw new SigenError(
          "CREDENCIAIS_INVALIDAS",
          "O SIGEN não confirmou o login. Verifique usuário e senha.",
          502,
        );
      }
    } catch (error) {
      await context.close().catch(() => undefined);
      throw error;
    }

    this.context = context;
    this.page = page;
    this.touch();
  }

  private async loginWithCredentials(page: Page): Promise<void> {
    try {
      await page.goto(`${this.config.baseUrl}/Account/LogOn`, {
        waitUntil: "domcontentloaded",
      });
      await page.fill("#nm_usuario", this.config.usuario);
      await page.fill("#ds_senha", this.config.senha);

      await page.click("#btnAcessar");

      // Alguns logins redirecionam; outros apenas trocam o conteúdo da SPA.
      // Esperamos a URL sair do LogOn ou o menu da home aparecer.
      await page.waitForFunction(
        () => {
          const path = window.location.pathname.toLowerCase();
          return (
            !path.includes("/account/logon") ||
            Boolean(document.querySelector("#filtroItemsTelas")) ||
            Boolean(document.querySelector("#menuLateralEsquerdo"))
          );
        },
        undefined,
        { timeout: 30_000 },
      );

      // A home carrega muitos recursos; não bloqueia o fluxo se demorar.
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => undefined);
    } catch (error) {
      const messages = await page
        .locator(".text-danger")
        .allTextContents()
        .catch(() => [] as string[]);
      const detail = messages.map((m) => m.trim()).filter(Boolean).join(" ");
      throw new SigenError(
        "CREDENCIAIS_INVALIDAS",
        detail || "Não consegui entrar no SIGEN. Verifique usuário e senha.",
        502,
      );
    }
  }

  private async checkSession(context: BrowserContext): Promise<boolean> {
    try {
      const response = await context.request.get(`${this.config.baseUrl}${UEP_LIST_PATH}`, {
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${this.config.baseUrl}/`,
        },
        maxRedirects: 0,
        timeout: 15_000,
      });
      if (response.status() !== 200) return false;
      const contentType = response.headers()["content-type"] ?? "";
      if (!contentType.includes("application/json")) return false;
      const body = (await response.json()) as { success?: boolean };
      return body?.success !== false;
    } catch {
      return false;
    }
  }

  private async resetContext(): Promise<void> {
    const context = this.context;
    this.context = null;
    this.page = null;
    if (context) await context.close().catch(() => undefined);
  }

  private async closeContext(notifyServer: boolean): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const context = this.context;
    this.context = null;
    this.page = null;
    this.state = "logged_out";

    if (!context) return;

    if (notifyServer) {
      await context.request
        .post(`${this.config.baseUrl}${LOGOUT_PATH}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
    await context.close().catch(() => undefined);
  }
}
