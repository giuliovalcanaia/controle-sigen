import { describe, expect, it } from "vitest";
import { openAnimalStore, type AnimalStore } from "../db.js";
import type { GtaForm } from "../sigen/gta.js";
import type { SigenGateway } from "../sigen/gateway.js";
import { SigenError } from "../sigen/types.js";
import type { UepRef } from "../sigen/uep.js";
import { createGtaService, type GtaService } from "./service.js";
import type { GtaPdfStore } from "./pdf.js";
import type {
  GtaDestinoUep,
  GtaFormInput,
  GtaInput,
  GtaJobView,
  GtaPermissao,
  SigenGtaRecord,
} from "./types.js";

const ORIGEM: UepRef = {
  id: "169696",
  nr: "1",
  codigoOficial: "42-000165623",
  localidade: "Capivari",
  municipio: "Doutor Pedrinho",
  uf: "SC",
  especie: "BOVINO",
  produtor: null,
};

const DESTINO: UepRef = {
  ...ORIGEM,
  id: "669790",
  codigoOficial: "42-000261071",
  localidade: "Coqueiral",
};

const DESTINO_UEP: GtaDestinoUep = {
  id: DESTINO.id,
  codigoOficial: DESTINO.codigoOficial,
  uep: DESTINO.nr,
  localidade: DESTINO.localidade,
  municipio: DESTINO.municipio,
  uf: DESTINO.uf,
  especie: "BOVINO",
  produtor: null,
};

const INPUT: GtaInput = {
  origem: { codigoOficial: "42-000165623", uep: "1" },
  destino: { tipo: "propria", codigoOficial: "42-000261071", uep: "1" },
  animais: [{ key: "076000003067836", brinco: "067836" }],
  finalidade: "ENGORDA",
  dataSaida: "2026-10-25",
  dataValidade: "2026-10-28",
  transporte: "RODOVIÁRIO",
};

const PERMITIDO: GtaPermissao = {
  exigeAnexo: false,
  exigeSenha: false,
  exigeDescricao: false,
  exigeJustificativaBloqueio: false,
};

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

type FakeOptions = {
  add?: () => Promise<{ id: number; data: unknown; message: string }>;
  print?: () => Promise<Buffer | null>;
};

function fakeForm(options: FakeOptions = {}) {
  const calls: string[] = [];
  const form: GtaForm = {
    async open() {
      calls.push("open");
    },
    async fill(_input: GtaFormInput, onProgress) {
      calls.push("fill");
      onProgress?.(1, 1);
    },
    async readRecord() {
      calls.push("record");
      return record();
    },
    verify() {
      calls.push("verify");
    },
    async preflight() {
      calls.push("preflight");
      return PERMITIDO;
    },
    async add() {
      calls.push("add");
      return options.add
        ? options.add()
        : { id: 10, data: {}, message: "GTA emitida" };
    },
    async get() {
      calls.push("get");
      return record();
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

type GatewayOptions = {
  form?: GtaForm;
  ueps?: UepRef[];
  quick?: GtaDestinoUep[];
  calls?: string[];
};

function fakeGateway(options: GatewayOptions = {}): SigenGateway {
  const form = options.form ?? fakeForm().form;
  return {
    listUeps: async () => options.ueps ?? [ORIGEM, DESTINO],
    quickSearchUeps: async () => {
      options.calls?.push("quickSearch");
      return options.quick ?? [];
    },
    runGtaForm: (fn) => fn(form),
  };
}

function fakePdfs(): GtaPdfStore {
  return {
    dir: "/tmp",
    save: () => "/tmp/gta.pdf",
    read: () => null,
    remove: () => undefined,
  };
}

function criar(options: {
  gateway?: SigenGateway;
  emissaoAtiva?: boolean;
} = {}): { service: GtaService; store: AnimalStore } {
  const store = openAnimalStore(":memory:");
  const service = createGtaService({
    gateway: options.gateway ?? fakeGateway(),
    store,
    pdfs: fakePdfs(),
    emissaoAtiva: options.emissaoAtiva ?? true,
  });
  return { service, store };
}

async function esperar(service: GtaService, id: number): Promise<GtaJobView> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const job = service.get(id);
    if (
      job &&
      ["emitida", "conferida", "erro", "incerta"].includes(job.status)
    ) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("A GTA não terminou a tempo.");
}

describe("GtaService", () => {
  it("emite, grava o número e o PDF", async () => {
    const { service, store } = criar();
    const { id } = await service.start({ input: INPUT, modo: "emitir" });
    const job = await esperar(service, id);

    expect(job.status).toBe("emitida");
    expect(job.numero).toBe("000 123456");
    expect(job.temPdf).toBe(true);
    expect(job.codigo).toBeNull();
    expect(store.getGta(id)?.status).toBe("emitida");
    store.close();
  });

  it("no modo conferir não chama Add", async () => {
    const { form, calls } = fakeForm();
    const { service, store } = criar({ gateway: fakeGateway({ form }) });

    const { id } = await service.start({ input: INPUT, modo: "conferir" });
    const job = await esperar(service, id);

    expect(job.status).toBe("conferida");
    expect(calls).not.toContain("add");
    store.close();
  });

  it("recusa emitir quando a emissão está desligada", async () => {
    const { service, store } = criar({ emissaoAtiva: false });

    await expect(
      service.start({ input: INPUT, modo: "emitir" }),
    ).rejects.toMatchObject({ code: "GTA_INDISPONIVEL" });
    store.close();
  });

  it("bloqueia a mesma viagem depois de emitida", async () => {
    const { service, store } = criar();
    const first = await service.start({ input: INPUT, modo: "emitir" });
    await esperar(service, first.id);

    await expect(
      service.start({ input: INPUT, modo: "emitir" }),
    ).rejects.toMatchObject({ code: "GTA_JA_EMITIDA" });
    store.close();
  });

  it("vira incerta quando o Add fica ambíguo", async () => {
    const { form } = fakeForm({
      add: async () => {
        throw new SigenError("GTA_NAO_CONFIRMADA", "Sem resposta.");
      },
    });
    const { service, store } = criar({ gateway: fakeGateway({ form }) });

    const { id } = await service.start({ input: INPUT, modo: "emitir" });
    const job = await esperar(service, id);

    expect(job.status).toBe("incerta");
    expect(job.erro).toContain("Confira no SIGEN");
    expect(job.codigo).toBe("GTA_NAO_CONFIRMADA");
    store.close();
  });

  it("mantém erro quando o SIGEN recusa de forma clara", async () => {
    const { form } = fakeForm({
      add: async () => {
        throw new SigenError("GTA_SIGEN_RECUSOU", "Animal já saiu.");
      },
    });
    const { service, store } = criar({ gateway: fakeGateway({ form }) });

    const { id } = await service.start({ input: INPUT, modo: "emitir" });
    const job = await esperar(service, id);

    expect(job.status).toBe("erro");
    expect(job.erro).toContain("Animal já saiu");
    store.close();
  });

  it("transforma UEP inválida em erro do job, não em falha do POST", async () => {
    const { service, store } = criar({
      gateway: fakeGateway({ ueps: [] }),
    });

    const { id } = await service.start({ input: INPUT, modo: "emitir" });
    const job = await esperar(service, id);

    expect(job.status).toBe("erro");
    expect(job.erro).toContain("Não encontrei a propriedade");
    expect(job.codigo).toBe("GTA_UEP_INVALIDA");
    store.close();
  });

  it("usa o QuickSearch para destino de terceiro", async () => {
    const calls: string[] = [];
    const { service, store } = criar({
      gateway: fakeGateway({
        ueps: [ORIGEM],
        quick: [DESTINO_UEP],
        calls,
      }),
    });

    const { id } = await service.start({
      input: {
        ...INPUT,
        destino: {
          tipo: "terceiro",
          cpf: "12345678901",
          codigoOficial: DESTINO.codigoOficial,
          uep: DESTINO.nr,
        },
      },
      modo: "emitir",
    });
    const job = await esperar(service, id);

    expect(calls).toContain("quickSearch");
    expect(job.status).toBe("emitida");
    store.close();
  });

  it("resolver a incerta libera a viagem", async () => {
    const { form } = fakeForm({
      add: async () => {
        throw new SigenError("GTA_NAO_CONFIRMADA", "Sem resposta.");
      },
    });
    const { service, store } = criar({ gateway: fakeGateway({ form }) });

    const { id } = await service.start({ input: INPUT, modo: "emitir" });
    await esperar(service, id);

    const resolvida = service.resolver(id, "nao_emitida");
    expect(resolvida.status).toBe("nao_emitida");

    const nova = await service.start({ input: INPUT, modo: "emitir" });
    expect(nova.id).not.toBe(id);
    await esperar(service, nova.id);
    store.close();
  });
});
