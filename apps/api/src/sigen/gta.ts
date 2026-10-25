import type { APIResponse, Frame, Page } from "playwright";
import {
  GTA_LOCAL_DESTINO_FLAG,
  GTA_MOTIVO_SAIDA_FLAG,
  GTA_TIPO_GTA_FLAG,
} from "../gta/constants.js";
import { formatBr, sanitizeErrorMessage } from "../gta/schema.js";
import type {
  GtaFormInput,
  GtaPermissao,
  GtaSaveResult,
  SigenAnimal,
  SigenGtaRecord,
} from "../gta/types.js";
import { SigenError, type ErrorCode } from "./types.js";

export type GtaProgress = (atual: number, total: number) => void;

/**
 * Operações da tela de GTA do SIGEN.
 *
 * A tela é ExtJS 3 e vive dentro do iframe da SPA. O preenchimento é feito
 * pela UI (os combos disparam callbacks no servidor), mas o salvamento é
 * feito pelos mesmos endpoints JSON que a própria tela usa. Assim não
 * dependemos de clicar em botão, passar por modal ou lidar com máscaras.
 */
export interface GtaForm {
  open(): Promise<void>;
  fill(input: GtaFormInput, onProgress?: GtaProgress): Promise<void>;
  readRecord(): Promise<SigenGtaRecord>;
  verify(record: SigenGtaRecord, input: GtaFormInput): void;
  preflight(record: SigenGtaRecord): Promise<GtaPermissao>;
  add(record: SigenGtaRecord): Promise<GtaSaveResult>;
  get(id: number): Promise<SigenGtaRecord>;
  print(id: number): Promise<Buffer | null>;
}

const GTA_SCREEN = "/DSA.Areas.Movimentacao/SaidaAnimais";
const MENU_MOVIMENTACAO = "Movimentação";
const MENU_GTA = /Saída de Animais e GTA/i;

function messageText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["error", "info", "message", "mensagem"]) {
      const item = record[key];
      if (typeof item === "string" && item.trim()) return item.trim();
      if (Array.isArray(item)) {
        const text = item.filter((entry) => typeof entry === "string").join(" ");
        if (text.trim()) return text.trim();
      }
    }
  }
  return "";
}

function dateOnly(value: unknown): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string" && value.trim()
        ? new Date(value)
        : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function officialBrinco(animal: SigenAnimal): string {
  if (typeof animal.nrBrincoNovo === "string" && animal.nrBrincoNovo.trim()) {
    return animal.nrBrincoNovo.trim();
  }
  if (typeof animal.nrBrinco === "number") {
    return String(animal.nrBrinco).padStart(15, "0");
  }
  return String(animal.nrBrinco ?? "").trim();
}

export class PlaywrightGtaForm implements GtaForm {
  private frame: Frame | null = null;
  private finalidadeId = "";
  private transporteId = "";

  constructor(
    private readonly page: Page,
    private readonly baseUrl: string,
  ) {}

  private get context() {
    return this.page.context();
  }

  private get formFrame(): Frame {
    if (!this.frame) {
      throw new SigenError(
        "GTA_TELA_MUDOU",
        "A tela de GTA do SIGEN não foi aberta.",
      );
    }
    return this.frame;
  }

  async open(): Promise<void> {
    await this.page.goto(`${this.baseUrl}/`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await this.page.waitForSelector("#menuLateralEsquerdo", { timeout: 30_000 });
    await this.page.getByText(MENU_MOVIMENTACAO, { exact: true }).first().click();
    await this.page.waitForTimeout(800);
    await this.page.getByText(MENU_GTA).first().click();
    this.frame = await this.waitForFrame();
    await this.formFrame
      .locator("#dtSaida")
      .waitFor({ state: "visible", timeout: 30_000 });

    // O formulário é ExtJS e só fica pronto quando o listener de `change`
    // da data de saída é registrado. Sem isso, preencher a data não abre os
    // campos de destino.
    await this.waitFor(
      `(() => { const c = window.Ext && Ext.getCmp("dtSaida"); return Boolean(c && c.events && c.events.change && c.events.change.listeners && c.events.change.listeners.length > 0); })()`,
      "inicialização da tela",
      30_000,
    );

    // Se o SIGEN restaurou um rascunho, começa um registro novo.
    const current = await this.formFrame.evaluate(
      `Ext.getCmp("idSaidaAnimais").getValue()`,
    );
    if (String(current ?? "").trim() !== "") {
      await this.formFrame.getByText("F7 - Novo").first().click();
      await this.page.waitForTimeout(1500);
    }
  }

  async fill(input: GtaFormInput, onProgress?: GtaProgress): Promise<void> {
    const frame = this.formFrame;

    await frame.locator("#dtSaida").click();
    await frame.locator("#dtSaida").fill(formatBr(input.dataSaida));
    await frame.locator("#dtSaida").press("Tab");

    const revealed = await this.formFrame
      .waitForFunction(
        `(() => { const c = window.Ext && Ext.getCmp("cbLocalDestino"); return c && !c.hidden; })()`,
        undefined,
        { timeout: 4000 },
      )
      .then(() => true)
      .catch(() => false);

    if (!revealed) {
      // Fallback: o preenchimento programático não disparou o `change` do
      // ExtJS. Força uma vez para abrir os campos de destino.
      await frame.evaluate(`(() => {
        const c = Ext.getCmp("dtSaida");
        if (c && c.fireEvent) c.fireEvent("change", c, c.getValue());
      })()`);
      await this.waitFor(
        `(() => { const c = window.Ext && Ext.getCmp("cbLocalDestino"); return c && !c.hidden; })()`,
        "campos de destino",
      );
    }

    await frame.locator("#dtValidade").click();
    await frame.locator("#dtValidade").fill(formatBr(input.dataValidade));
    await frame.locator("#dtValidade").press("Tab");
    await this.page.waitForTimeout(500);

    await this.selectFlag("cbLocalDestino", GTA_LOCAL_DESTINO_FLAG);
    await this.waitFor(
      `(() => { const c = window.Ext && Ext.getCmp("cbMotivoSaida"); return c && !c.hidden; })()`,
      "motivo da saída",
    );
    await this.selectFlag("cbMotivoSaida", GTA_MOTIVO_SAIDA_FLAG);
    await this.waitFor(
      `(() => { const c = window.Ext && Ext.getCmp("UnidadeExploracaoOrigem_cbUnidadeExploracao"); return c && !c.hidden; })()`,
      "produtor de origem",
    );

    const documentoOrigem = String(
      await frame.evaluate(`Ext.getCmp("nrDocumentoRegistro").getValue()`),
    ).trim();
    if (!documentoOrigem) {
      throw new SigenError(
        "GTA_CPF_ORIGEM",
        "Não consegui identificar o CPF do produtor na tela do SIGEN.",
      );
    }

    await this.selectUep(
      "UnidadeExploracaoOrigem_cbUnidadeExploracao",
      documentoOrigem,
      input.origemUepId,
    );

    const documentoDestino =
      input.destino.tipo === "propria"
        ? documentoOrigem
        : input.documentoDestino.trim();
    if (!documentoDestino) {
      throw new SigenError(
        "GTA_UEP_INVALIDA",
        "Informe o CPF do produtor de destino.",
      );
    }

    await this.selectUep(
      "UnidadeExploracaoDestino_cbUnidadeExploracao",
      documentoDestino,
      input.destinoUepId,
    );

    await this.waitFor(
      `(() => { const c = window.Ext && Ext.getCmp("cbFinalidadeGta"); return c && c.store && c.store.getCount() > 0; })()`,
      "finalidade",
    );
    await this.selectFinalidade(input.finalidade);
    await this.selectTransporte(input.transporte);

    const total = input.animais.length;
    for (const [index, animal] of input.animais.entries()) {
      const before = Number(
        await frame.evaluate(`Ext.getCmp("gdrBrincos").store.getCount()`),
      );

      await frame.evaluate(`(() => {
        const c = Ext.getCmp("cbNrManejo");
        c.setRawValue(${JSON.stringify(animal.brinco)});
        c.doQuery(${JSON.stringify(animal.brinco)}, true);
      })()`);

      try {
        await frame.waitForFunction(
          `Ext.getCmp("gdrBrincos").store.getCount() > ${before}`,
          undefined,
          { timeout: 20_000 },
        );
      } catch {
        throw new SigenError(
          "GTA_ANIMAL_NAO_ENCONTRADO",
          `O SIGEN não encontrou o animal de manejo ${animal.brinco} nesta propriedade.`,
        );
      }

      const added = (await frame.evaluate(`(() => {
        const store = Ext.getCmp("gdrBrincos").store;
        const record = store.getAt(store.getCount() - 1);
        return { brinco: record.get("nrBrincoNovo"), manejo: record.get("nrManejo") };
      })()`)) as { brinco?: string; manejo?: number | string };

      if (String(added.brinco ?? "").trim() !== animal.key) {
        throw new SigenError(
          "GTA_ANIMAIS_DIVERGENTES",
          `O manejo ${animal.brinco} corresponde a outro brinco oficial no SIGEN. Nada foi emitido.`,
        );
      }

      onProgress?.(index + 1, total);
    }

    await this.setField("nrNotaFiscal", input.notaFiscal);
    await this.setField("nrPlaca", input.placa);
    await this.setField("nrLacre", input.lacre);
    await this.setField("dsObservacao", input.observacao);
  }

  async readRecord(): Promise<SigenGtaRecord> {
    return (await this.formFrame.evaluate(
      `window.getRecord()`,
    )) as SigenGtaRecord;
  }

  verify(record: SigenGtaRecord, input: GtaFormInput): void {
    const body = record?.saidaAnimais;
    if (!body) {
      throw new SigenError(
        "GTA_TELA_MUDOU",
        "Não consegui ler os dados da GTA na tela do SIGEN. Nada foi emitido.",
      );
    }

    const fail = (message: string) => {
      throw new SigenError("GTA_TELA_MUDOU", `${message} Nada foi emitido.`);
    };

    if (body.localDestino?.csFlag !== GTA_LOCAL_DESTINO_FLAG) {
      fail("O local de destino não ficou como “Dentro do Estado”.");
    }
    if (body.motivoSaida?.csFlag !== GTA_MOTIVO_SAIDA_FLAG) {
      fail("O destino não ficou como “Propriedade”.");
    }
    if (body.tipoGta?.csFlag !== GTA_TIPO_GTA_FLAG) {
      fail("O tipo da GTA não ficou como “Normal”.");
    }

    if (
      String(body.unidadeExploracaoOrigem?.idUnidadeExploracao ?? "") !==
      input.origemUepId
    ) {
      fail("A propriedade de origem não confere.");
    }
    if (
      String(body.unidadeExploracaoDestino?.idUnidadeExploracao ?? "") !==
      input.destinoUepId
    ) {
      fail("A propriedade de destino não confere.");
    }
    if (!body.pessoaEmitente?.idPessoa) {
      fail("O emitente da GTA não foi preenchido.");
    }
    if (!body.municipioGta?.idMunicipio) {
      fail("O município de emissão não foi preenchido.");
    }

    if (dateOnly(body.dtSaida) !== input.dataSaida) {
      fail("A data de saída não confere.");
    }
    if (dateOnly(body.dtValidade) !== input.dataValidade) {
      fail("A data de validade não confere.");
    }
    if (String(body.finalidadeGta?.idFinalidadeGta ?? "") !== this.finalidadeId) {
      fail("A finalidade não confere.");
    }
    if (
      String(body.meioTransporteGta?.idMeioTransporteGta ?? "") !==
      this.transporteId
    ) {
      fail("O meio de transporte não confere.");
    }

    const expected = input.animais.map((animal) => animal.key).sort();
    const actual = (body.listaSaidaAnimaisBrinco ?? [])
      .map((animal) => officialBrinco(animal))
      .sort();
    if (
      expected.length !== actual.length ||
      expected.some((key, index) => key !== actual[index])
    ) {
      throw new SigenError(
        "GTA_ANIMAIS_DIVERGENTES",
        "A lista de animais da GTA não confere com a seleção. Nada foi emitido.",
      );
    }
  }

  async preflight(record: SigenGtaRecord): Promise<GtaPermissao> {
    const body = record.saidaAnimais;
    const response = await this.context.request.post(
      `${this.baseUrl}${GTA_SCREEN}/VerificarPermissaoApoio`,
      {
        data: {
          csMotivoSaida: body.motivoSaida.csFlag,
          csLocalDestino: body.localDestino.csFlag,
          unidadeExploracaoOrigem: body.unidadeExploracaoOrigem,
          unidadeExploracaoDestino: body.unidadeExploracaoDestino ?? {
            idUnidadeExploracao: 0,
          },
          dtSaida: body.dtSaida,
          csTipoGta: body.tipoGta.csFlag,
          listaBrincos: body.listaSaidaAnimaisBrinco,
        },
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${this.baseUrl}${GTA_SCREEN}`,
        },
        timeout: 30_000,
      },
    );

    const payload = await this.json(response, "GTA_SIGEN_RECUSOU");
    if (payload.success === false) {
      throw new SigenError(
        "GTA_SIGEN_RECUSOU",
        messageText(payload.message) ||
          "O SIGEN recusou a conferência desta GTA.",
      );
    }

    const data = (payload.data ?? {}) as Record<string, unknown>;
    return {
      exigeAnexo: Boolean(data.exigeAnexo),
      exigeSenha: Boolean(data.exigeSenha),
      exigeDescricao: Boolean(data.exigeDescricao),
      exigeJustificativaBloqueio: Boolean(data.exigeJustificativaBloqueio),
    };
  }

  async add(record: SigenGtaRecord): Promise<GtaSaveResult> {
    const response = await this.context.request.post(
      `${this.baseUrl}${GTA_SCREEN}/Add`,
      {
        data: record,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${this.baseUrl}${GTA_SCREEN}`,
        },
        timeout: 60_000,
      },
    );

    const payload = await this.json(response, "GTA_NAO_CONFIRMADA");
    if (payload.success === false) {
      throw new SigenError(
        "GTA_SIGEN_RECUSOU",
        messageText(payload.message) || "O SIGEN recusou a emissão da GTA.",
      );
    }

    const data = payload.data as Record<string, unknown> | undefined;
    const id = Number(data?.idSaidaAnimais ?? 0);
    if (!Number.isFinite(id) || id <= 0) {
      throw new SigenError(
        "GTA_NAO_CONFIRMADA",
        "O SIGEN respondeu à emissão, mas não devolveu o número do registro. Confira no SIGEN antes de tentar de novo.",
      );
    }

    return { id, data, message: messageText(payload.message) };
  }

  async get(id: number): Promise<SigenGtaRecord> {
    const response = await this.context.request.get(
      `${this.baseUrl}${GTA_SCREEN}/Get/${id}`,
      {
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${this.baseUrl}${GTA_SCREEN}`,
        },
        timeout: 30_000,
      },
    );

    const payload = await this.json(response, "SIGEN_ERRO");
    if (payload.success === false) {
      throw new SigenError(
        "SIGEN_ERRO",
        messageText(payload.message) || "Não consegui reler a GTA emitida.",
      );
    }
    return { saidaAnimais: payload.data as SigenGtaRecord["saidaAnimais"] };
  }

  async print(id: number): Promise<Buffer | null> {
    const response = await this.context.request.post(
      `${this.baseUrl}${GTA_SCREEN}/Print`,
      {
        form: { idSaidaAnimais: String(id) },
        headers: { Accept: "application/pdf, text/html" },
        timeout: 60_000,
      },
    );

    const contentType = response.headers()["content-type"] ?? "";
    if (!contentType.includes("application/pdf")) return null;
    return Buffer.from(await response.body());
  }

  private async waitForFrame(): Promise<Frame> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const frame = this.page.frame({ url: /SaidaAnimais/ });
      if (frame) {
        try {
          await frame.locator("#dtSaida").waitFor({
            state: "visible",
            timeout: 1000,
          });
          return frame;
        } catch {
          // O iframe ainda está carregando.
        }
      }
      await this.page.waitForTimeout(500);
    }

    throw new SigenError(
      "GTA_TELA_MUDOU",
      "Não consegui abrir a tela de GTA do SIGEN. Nada foi emitido.",
    );
  }

  private async waitFor(
    expression: string,
    label: string,
    timeout = 20_000,
  ): Promise<void> {
    try {
      await this.formFrame.waitForFunction(expression, undefined, { timeout });
    } catch {
      throw new SigenError(
        "GTA_TELA_MUDOU",
        `A tela de GTA do SIGEN não respondeu (${label}). Nada foi emitido.`,
      );
    }
  }

  private async selectFlag(id: string, flag: string): Promise<void> {
    await this.waitFor(
      `(() => { const c = window.Ext && Ext.getCmp(${JSON.stringify(id)}); return c && c.store && c.store.getCount() > 0; })()`,
      `opções de ${id}`,
    );

    const result = (await this.formFrame.evaluate(`(() => {
      const E = window.Ext;
      const c = E.getCmp(${JSON.stringify(id)});
      if (!c) return { ok: false, reason: "sem componente" };
      const store = c.getStore();
      const index = store.find("csFlag", ${JSON.stringify(flag)});
      if (index < 0) return { ok: false, reason: "sem opcao" };
      const record = store.getAt(index);
      c.setValue(record.get("csFlag"));
      c.fireEvent("select", c, record, index);
      return { ok: true };
    })()`)) as { ok: boolean; reason?: string };

    if (!result.ok) {
      throw new SigenError(
        "GTA_TELA_MUDOU",
        "Não encontrei uma opção obrigatória da GTA no SIGEN. Nada foi emitido.",
      );
    }
  }

  private async selectUep(
    comboId: string,
    documento: string,
    uepId: string,
  ): Promise<void> {
    await this.formFrame.evaluate(`(() => {
      const c = Ext.getCmp(${JSON.stringify(comboId)});
      c.doQuery(${JSON.stringify(documento)}, true);
    })()`);

    await this.waitFor(
      `(() => { const c = window.Ext && Ext.getCmp(${JSON.stringify(comboId)}); return c && c.store && c.store.getCount() > 0; })()`,
      "busca de propriedade",
    );

    const result = (await this.formFrame.evaluate(`(() => {
      const E = window.Ext;
      const c = E.getCmp(${JSON.stringify(comboId)});
      const store = c.store;
      const index = store.findBy((r) =>
        String(r.get("id_unidade_exploracao")) === ${JSON.stringify(uepId)} &&
        String(r.get("nm_especie_animal")) === "BOVINO"
      );
      if (index < 0) return { ok: false, count: store.getCount() };
      const record = store.getAt(index);
      c.setValue(record.get("id_unidade_exploracao"));
      c.fireEvent("select", c, record, index);
      return {
        ok: true,
        id: String(record.get("id_unidade_exploracao")),
        codigo: record.get("cd_oficial"),
        uep: record.get("nr_unidade_exploracao"),
      };
    })()`)) as { ok: boolean; id?: string; count?: number };

    if (!result.ok) {
      throw new SigenError(
        "GTA_UEP_INVALIDA",
        "Não encontrei essa propriedade no CPF informado. Nada foi emitido.",
      );
    }

    const hiddenId = comboId.replace(
      "_cbUnidadeExploracao",
      "_cdOficialFormatado",
    );
    await this.waitFor(
      `(() => { const c = window.Ext && Ext.getCmp(${JSON.stringify(hiddenId)}); return c && String(c.getValue() ?? "").trim() !== ""; })()`,
      "confirmação da propriedade",
    );
  }

  private async selectFinalidade(text: string): Promise<void> {
    const result = (await this.formFrame.evaluate(`(() => {
      const E = window.Ext;
      const c = E.getCmp("cbFinalidadeGta");
      const store = c.store;
      const index = store.find("dsFinalidadeGta", ${JSON.stringify(text)});
      if (index < 0) return { ok: false, count: store.getCount() };
      const record = store.getAt(index);
      c.setValue(record.get("idFinalidadeGta"));
      c.fireEvent("select", c, record, index);
      return { ok: true, id: String(record.get("idFinalidadeGta")) };
    })()`)) as { ok: boolean; id?: string };

    if (!result.ok || !result.id) {
      throw new SigenError(
        "GTA_TELA_MUDOU",
        `A finalidade “${text}” não está disponível no SIGEN. Nada foi emitido.`,
      );
    }
    this.finalidadeId = result.id;
  }

  private async selectTransporte(text: string): Promise<void> {
    const result = (await this.formFrame.evaluate(`(() => {
      const E = window.Ext;
      const c = E.getCmp("cbMeioTransporteGta");
      const store = c.store;
      const index = store.find("dsMeioTransporteGta", ${JSON.stringify(text)});
      if (index < 0) return { ok: false, count: store.getCount() };
      const record = store.getAt(index);
      c.setValue(record.get("idMeioTransporteGta"));
      c.fireEvent("select", c, record, index);
      return { ok: true, id: String(record.get("idMeioTransporteGta")) };
    })()`)) as { ok: boolean; id?: string };

    if (!result.ok || !result.id) {
      throw new SigenError(
        "GTA_TELA_MUDOU",
        `O meio de transporte “${text}” não está disponível no SIGEN. Nada foi emitido.`,
      );
    }
    this.transporteId = result.id;
  }

  private async setField(id: string, value: string | undefined): Promise<void> {
    if (!value) return;
    await this.formFrame.evaluate(`(() => {
      const c = Ext.getCmp(${JSON.stringify(id)});
      if (c) c.setValue(${JSON.stringify(value)});
    })()`);
  }

  private async json(
    response: APIResponse,
    code: ErrorCode,
  ): Promise<Record<string, unknown>> {
    if (response.status() >= 300 && response.status() < 400) {
      throw new SigenError("SESSAO_EXPIRADA", "A sessão do SIGEN expirou.");
    }
    const contentType = response.headers()["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      throw new SigenError(
        code,
        "O SIGEN respondeu em um formato inesperado. Nada foi emitido.",
      );
    }
    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      throw new SigenError(
        code,
        "Não consegui ler a resposta do SIGEN. Nada foi emitido.",
      );
    }
  }
}

export function gtaErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Não foi possível emitir a GTA.";
  return sanitizeErrorMessage(message);
}
