import type { APIResponse, BrowserContext } from "playwright";
import type { GtaDestinoUep } from "../gta/types.js";
import { groupInventories } from "./inventory.js";
import { parseInventoryText, pdfToText } from "./pdf.js";
import type { SigenSession } from "./session.js";
import { SigenError, type Inventory, type ParsedInventory } from "./types.js";
import { collectUeps, type UepRef } from "./uep.js";

const UEP_LIST_PATH =
  "/DSA.Cadastros/UnidadeExploracao/VerificarPermissaoImprimirInventarioHome";
const UEP_PDF_PATH =
  "/DSA.Cadastros/UnidadeExploracao/ImprimeInventarioAnimais";
const UEP_QUICK_SEARCH_PATH =
  "/DSA.Cadastros/UnidadeExploracao/QuickSearch";

function isLoginResponse(response: APIResponse): boolean {
  if (response.status() >= 300 && response.status() < 400) return true;
  if (response.status() >= 500) return false;
  const contentType = response.headers()["content-type"] ?? "";
  return contentType.includes("text/html");
}

function responseMessage(body: unknown): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const message = record.message ?? record.mensagem ?? record.error;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return "";
}

export class SigenClient {
  constructor(
    private readonly session: SigenSession,
    private readonly baseUrl: string,
  ) {}

  async getInventory(
    onProgress?: (atual: number, total: number) => void,
  ): Promise<Inventory> {
    // A sessão fica presa só o tempo dos downloads. `pdftotext` e o parsing
    // são locais e rodam depois, fora do mutex, sem bloquear uma emissão.
    const baixados = await this.session.withContext(async (context) => {
      const ueps = await this.listUeps(context);
      if (ueps.length === 0) {
        throw new SigenError(
          "UEP_LIST_EMPTY",
          "O SIGEN não retornou nenhuma unidade de exploração para este produtor.",
        );
      }

      // Só baixamos PDFs de UEPs bovinas. Se a API não informar a espécie
      // (layout antigo), mantemos todas como fallback.
      const bovinas = ueps.filter(
        (uep) => uep.especie?.toUpperCase() === "BOVINO",
      );
      const uepIds = (bovinas.length > 0 ? bovinas : ueps).map(
        (uep) => uep.id,
      );

      const pdfs: Array<{ uepId: string; bytes: Buffer }> = [];
      const warnings: string[] = [];

      onProgress?.(0, uepIds.length);

      for (const uepId of uepIds) {
        try {
          pdfs.push({
            uepId,
            bytes: await this.downloadInventoryPdf(context, uepId),
          });
        } catch (error) {
          if (error instanceof SigenError && error.code === "SESSAO_EXPIRADA") {
            throw error;
          }
          const message =
            error instanceof Error ? error.message : String(error);
          warnings.push(`UEP ${uepId}: ${message}`);
        }
      }

      return { uepIds, pdfs, warnings };
    });

    const parsed: ParsedInventory[] = [];
    const warnings = [...baixados.warnings];

    for (const [index, { uepId, bytes }] of baixados.pdfs.entries()) {
      try {
        const text = await pdfToText(bytes);
        const inventory = parseInventoryText(text);
        if (inventory.especie.toUpperCase() === "BOVINO") {
          parsed.push(inventory);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(`UEP ${uepId}: ${message}`);
      }

      onProgress?.(index + 1, baixados.uepIds.length);
    }

    if (parsed.length === 0) {
      throw new SigenError(
        "SIGEN_ERRO",
        warnings[0] ??
          "Nenhum inventário bovino pôde ser lido. O layout do SIGEN pode ter mudado.",
      );
    }

    const inventory = groupInventories(parsed);
    return { ...inventory, avisos: warnings };
  }

  /** Lista as UEPs com código, nº, localidade e espécie (sem CPF). */
  async getUeps(): Promise<UepRef[]> {
    return this.session.withContext((context) => this.listUeps(context));
  }

  /**
   * Busca as UEPs de um CPF/CNPJ na mesma consulta que a tela de GTA usa.
   * Devolve só BOVINO e sem CPF/telefone/endereço.
   */
  async quickSearchUeps(
    cpf: string,
    dataSaida: string,
  ): Promise<GtaDestinoUep[]> {
    const dtSaida = new Date(`${dataSaida}T00:00:00-03:00`).toISOString();

    return this.session.withContext(async (context) => {
      const response = await context.request.post(
        `${this.baseUrl}${UEP_QUICK_SEARCH_PATH}`,
        {
          form: {
            fitroHabilitacao: "False",
            filtroEvento: "",
            listarExcluidas: "False",
            idEspecieFiltro: "",
            idGrupoEspecie: "",
            tipoPropriedade: "",
            dtSaida,
            idMunicipioFiltro: "",
            idOficialPropriedade: "",
            flTek: "",
            listarTodas: "",
            filtroForaDoEstado: "",
            listarProdutor: "True",
            bloqueiCodigoOficial: "",
            idPessoaAutorizada: "",
            paramTipoGta: "S",
            query: cpf,
          },
          headers: {
            Accept: "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            Referer: `${this.baseUrl}/DSA.Areas.Movimentacao/SaidaAnimais`,
          },
          timeout: 30_000,
        },
      );

      if (response.status() >= 300 && response.status() < 400) {
        throw new SigenError("SESSAO_EXPIRADA", "A sessão do SIGEN expirou.");
      }
      if (!response.ok()) {
        throw new SigenError(
          "SIGEN_ERRO",
          `O SIGEN respondeu ${response.status()} ao buscar propriedades.`,
        );
      }

      const contentType = response.headers()["content-type"] ?? "";
      if (!contentType.includes("application/json")) {
        throw new SigenError(
          "SIGEN_ERRO",
          "O SIGEN respondeu em um formato inesperado ao buscar propriedades.",
        );
      }

      const body = (await response.json()) as {
        success?: boolean;
        data?: unknown[];
        message?: unknown;
      };
      if (body.success === false) {
        throw new SigenError(
          "GTA_SIGEN_RECUSOU",
          responseMessage(body) || "O SIGEN recusou a busca por propriedades.",
        );
      }

      const rows = Array.isArray(body.data) ? body.data : [];
      return rows
        .filter(
          (row): row is Record<string, unknown> =>
            Boolean(row) &&
            typeof row === "object" &&
            String((row as Record<string, unknown>).nm_especie_animal ?? "")
              .toUpperCase() === "BOVINO",
        )
        .map((row) => {
          const codigo = String(row.cd_oficial ?? "").replace(/\D/g, "");
          const ibge = String(row.nr_codigo_IBGE ?? "42").replace(/\D/g, "");
          return {
            id: String(row.id_unidade_exploracao ?? ""),
            codigoOficial: `${ibge}-${codigo.padStart(9, "0")}`,
            uep: String(row.nr_unidade_exploracao ?? ""),
            localidade: String(row.nm_localidade ?? ""),
            municipio: String(row.nm_municipio ?? ""),
            uf: String(row.sg_uf ?? "SC"),
            especie: String(row.nm_especie_animal ?? "BOVINO"),
            produtor:
              typeof row.nm_pessoa === "string" ? row.nm_pessoa : null,
          };
        });
    });
  }

  private async listUeps(context: BrowserContext): Promise<UepRef[]> {
    const response = await context.request.get(`${this.baseUrl}${UEP_LIST_PATH}`, {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${this.baseUrl}/`,
      },
      timeout: 30_000,
    });

    if (isLoginResponse(response)) {
      throw new SigenError("SESSAO_EXPIRADA", "A sessão do SIGEN expirou.");
    }
    if (!response.ok()) {
      throw new SigenError(
        "SIGEN_FORA",
        `O SIGEN respondeu ${response.status()} ao listar as unidades.`,
      );
    }

    const contentType = response.headers()["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      throw new SigenError("SESSAO_EXPIRADA", "A sessão do SIGEN expirou.");
    }

    const body = (await response.json()) as Record<string, unknown>;
    if (body && body.success === false) {
      throw new SigenError(
        "SIGEN_ERRO",
        responseMessage(body) || "O SIGEN recusou a listagem de unidades.",
      );
    }

    return collectUeps(body);
  }

  private async downloadInventoryPdf(
    context: BrowserContext,
    uepId: string,
  ): Promise<Buffer> {
    // O Angular envia a data em ISO. Algumas versões do backend aceitam
    // apenas a data brasileira; tentamos as duas sem repetir o download
    // quando o PDF já veio.
    const attempts = [
      new Date().toISOString(),
      new Date().toLocaleDateString("pt-BR"),
    ];
    let lastError: SigenError | null = null;

    for (const dtConsulta of attempts) {
      const response = await context.request.post(`${this.baseUrl}${UEP_PDF_PATH}`, {
        params: { idUnidadeExploracao: uepId, dtConsulta },
        headers: {
          Accept: "application/pdf, application/json",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${this.baseUrl}/`,
        },
        timeout: 60_000,
      });

      if (isLoginResponse(response)) {
        throw new SigenError("SESSAO_EXPIRADA", "A sessão do SIGEN expirou.");
      }

      const contentType = response.headers()["content-type"] ?? "";
      if (contentType.includes("application/pdf")) {
        return Buffer.from(await response.body());
      }

      if (contentType.includes("application/json")) {
        const body = (await response.json()) as Record<string, unknown>;
        lastError = new SigenError(
          "SIGEN_ERRO",
          responseMessage(body) || "O SIGEN não gerou o PDF do inventário.",
        );
        continue;
      }

      lastError = new SigenError(
        "SIGEN_ERRO",
        `O SIGEN respondeu ${response.status()} com um formato inesperado.`,
      );
    }

    throw (
      lastError ??
      new SigenError("SIGEN_ERRO", "O SIGEN não gerou o PDF do inventário.")
    );
  }
}
