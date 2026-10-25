import { describe, expect, it } from "vitest";
import type { GtaForm } from "../sigen/gta.js";
import { SigenError } from "../sigen/types.js";
import { runGtaJob } from "./runner.js";
import type {
  GtaFormInput,
  GtaPermissao,
  SigenGtaRecord,
} from "./types.js";

function record(): SigenGtaRecord {
  return {
    saidaAnimais: {
      localDestino: { csFlag: "DE" },
      motivoSaida: { csFlag: "TR" },
      tipoGta: { csFlag: "NO" },
      finalidadeGta: { idFinalidadeGta: 1 },
      meioTransporteGta: { idMeioTransporteGta: "1" },
      dtSaida: "2026-10-25T03:00:00.000Z",
      dtValidade: "2026-10-28T03:00:00.000Z",
      unidadeExploracaoOrigem: { idUnidadeExploracao: 169696 },
      unidadeExploracaoDestino: { idUnidadeExploracao: 669790 },
      pessoaEmitente: { idPessoa: 207951 },
      listaSaidaAnimaisBrinco: [{ nrBrincoNovo: "076000003067836" }],
      municipioGta: { idMunicipio: 4391 },
      gta: { dsSerieGta: "000", nrSequenciaGta: "123456" },
    },
  };
}

const input: GtaFormInput = {
  origem: { codigoOficial: "42-000165623", uep: "1" },
  destino: { tipo: "propria", codigoOficial: "42-000261071", uep: "1" },
  animais: [{ key: "076000003067836", brinco: "067836" }],
  finalidade: "ENGORDA",
  dataSaida: "2026-10-25",
  dataValidade: "2026-10-28",
  transporte: "RODOVIÁRIO",
  origemUepId: "169696",
  destinoUepId: "669790",
  documentoOrigem: "",
  documentoDestino: "",
};

const permitido: GtaPermissao = {
  exigeAnexo: false,
  exigeSenha: false,
  exigeDescricao: false,
  exigeJustificativaBloqueio: false,
};

type FakeOptions = {
  permission?: Partial<GtaPermissao>;
  verify?: () => void;
  add?: () => Promise<{ id: number; data: unknown; message: string }>;
  get?: () => Promise<SigenGtaRecord>;
  print?: () => Promise<Buffer | null>;
};

function fakeForm(options: FakeOptions = {}) {
  const calls: string[] = [];
  const form: GtaForm = {
    async open() {
      calls.push("open");
    },
    async fill(_input, onProgress) {
      calls.push("fill");
      onProgress?.(1, 1);
    },
    async readRecord() {
      calls.push("record");
      return record();
    },
    verify() {
      calls.push("verify");
      options.verify?.();
    },
    async preflight() {
      calls.push("preflight");
      return { ...permitido, ...options.permission };
    },
    async add() {
      calls.push("add");
      return options.add
        ? options.add()
        : { id: 10, data: {}, message: "GTA emitida" };
    },
    async get() {
      calls.push("get");
      return options.get ? options.get() : record();
    },
    async print() {
      calls.push("print");
      return options.print
        ? options.print()
        : Buffer.from("%PDF-1.4 fake");
    },
  };
  return { form, calls };
}

describe("runGtaJob", () => {
  it("salva uma vez e devolve número e PDF", async () => {
    const { form, calls } = fakeForm();
    const progress: number[][] = [];
    let savedBeforeAdd = false;

    const result = await runGtaJob(
      form,
      input,
      "emitir",
      (atual, total) => progress.push([atual, total]),
      () => {
        savedBeforeAdd = calls.includes("preflight") && !calls.includes("add");
      },
    );

    expect(result).toEqual({
      status: "emitida",
      numero: "000 123456",
      pdf: Buffer.from("%PDF-1.4 fake"),
    });
    expect(calls).toEqual([
      "open",
      "fill",
      "record",
      "verify",
      "preflight",
      "add",
      "get",
      "print",
    ]);
    expect(savedBeforeAdd).toBe(true);
    expect(progress).toEqual([[1, 1]]);
  });

  it("no modo conferir, para antes do Add", async () => {
    const { form, calls } = fakeForm();

    const result = await runGtaJob(form, input, "conferir");

    expect(result.status).toBe("conferida");
    expect(result.numero).toBeNull();
    expect(calls).not.toContain("add");
  });

  it("não salva quando o SIGEN pede senha ou anexo", async () => {
    const { form, calls } = fakeForm({
      permission: { exigeSenha: true },
    });

    await expect(runGtaJob(form, input, "emitir")).rejects.toMatchObject({
      code: "GTA_INDISPONIVEL",
    });
    expect(calls).not.toContain("add");
  });

  it("propaga a recusa clara do SIGEN sem marcar incerta", async () => {
    const { form, calls } = fakeForm({
      add: async () => {
        throw new SigenError("GTA_SIGEN_RECUSOU", "Animal já saiu.");
      },
    });

    await expect(runGtaJob(form, input, "emitir")).rejects.toMatchObject({
      code: "GTA_SIGEN_RECUSOU",
    });
    expect(calls).toContain("add");
  });

  it("propaga falha ambígua depois do Add", async () => {
    const { form, calls } = fakeForm({
      add: async () => {
        throw new SigenError("GTA_NAO_CONFIRMADA", "Sem resposta.");
      },
    });

    await expect(runGtaJob(form, input, "emitir")).rejects.toMatchObject({
      code: "GTA_NAO_CONFIRMADA",
    });
    expect(calls).toContain("add");
  });

  it("mantém emitida quando só a releitura do número falha", async () => {
    const { form } = fakeForm({
      get: async () => {
        throw new SigenError("SIGEN_ERRO", "Não consegui reler.");
      },
    });

    const result = await runGtaJob(form, input, "emitir");

    expect(result.status).toBe("emitida");
    expect(result.numero).toBeNull();
    expect(result.pdf).not.toBeNull();
  });

  it("não chama preflight nem Add quando a conferência falha", async () => {
    const { form, calls } = fakeForm({
      verify: () => {
        throw new SigenError("GTA_ANIMAIS_DIVERGENTES", "Animal errado.");
      },
    });

    await expect(runGtaJob(form, input, "emitir")).rejects.toMatchObject({
      code: "GTA_ANIMAIS_DIVERGENTES",
    });
    expect(calls).not.toContain("preflight");
    expect(calls).not.toContain("add");
  });
});
