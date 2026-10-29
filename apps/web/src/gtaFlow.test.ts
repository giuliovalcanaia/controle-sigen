import { describe, expect, it } from "vitest";
import {
  gtaFlowReducer,
  initialGtaFlowState,
  parseDocumento,
  podeIniciar,
  resultadoDaGta,
  tituloDoCartao,
  type GtaFlowEvent,
  type GtaFlowState,
} from "./gtaFlow";
import type {
  Animal,
  GtaDestinoUep,
  GtaJobView,
  GtaOptions,
  Inventory,
} from "./types";

const ANIMAL_A: Animal = {
  key: "999000000067836",
  brinco: "067836",
  brincoOficial: "999000000067836",
  uep: "1",
  sexo: "Fêmea",
  idade: { anos: 2, meses: 1 },
  nascimento: "2024-09-01",
  apelido: "Mimosa",
  fotoVersao: null,
};

const ANIMAL_B: Animal = {
  ...ANIMAL_A,
  key: "999000000069054",
  brinco: "069054",
  brincoOficial: "999000000069054",
  apelido: null,
};

const ANIMAL_C: Animal = {
  ...ANIMAL_A,
  key: "999000000685501",
  brinco: "685501",
  brincoOficial: "999000000685501",
  uep: "1",
  apelido: "Estrela",
};

const INVENTORY: Inventory = {
  buscadoEm: "2026-10-28T10:00:00.000Z",
  total: 3,
  avisos: [],
  propriedades: [
    {
      codigo: "42-900000001",
      localidade: "Sede",
      municipio: "Vale do Cedro",
      uf: "SC",
      ueps: ["1"],
      animais: [ANIMAL_A, ANIMAL_B],
    },
    {
      codigo: "42-900000004",
      localidade: "Alto da Serra",
      municipio: "Vale do Cedro",
      uf: "SC",
      ueps: ["1"],
      animais: [ANIMAL_C],
    },
  ],
};

const ORIGEM = "42-900000001-1";
const OUTRA_ORIGEM = "42-900000004-1";

const OPTIONS: GtaOptions = {
  finalidades: ["ENGORDA", "REPRODUÇÃO"],
  transportes: ["RODOVIÁRIO", "AÉREO"],
  hoje: "2026-10-28",
  validadePadrao: "2026-10-31",
  maxAnimais: 50,
  uf: "SC",
  emissaoAtiva: true,
};

const DESTINO_UEP: GtaDestinoUep = {
  id: "911677",
  codigoOficial: "42-900000004",
  uep: "1",
  localidade: "Alto da Serra",
  municipio: "Vale do Cedro",
  uf: "SC",
  especie: "BOVINO",
  produtor: "Vizinho",
};

const UEP_ORIGEM: GtaDestinoUep = {
  ...DESTINO_UEP,
  id: "169696",
  codigoOficial: "42-900000001",
  localidade: "Sede",
};

function job(overrides: Partial<GtaJobView> = {}): GtaJobView {
  return {
    id: 7,
    status: "preparando",
    etapa: "conferindo",
    atual: 0,
    total: 1,
    numero: null,
    temPdf: false,
    erro: null,
    codigo: null,
    criadaEm: "2026-10-28T10:00:00.000Z",
    atualizadaEm: "2026-10-28T10:00:00.000Z",
    ...overrides,
  };
}

function run(
  state: GtaFlowState,
  ...eventos: GtaFlowEvent[]
): GtaFlowState {
  return eventos.reduce(gtaFlowReducer, state);
}

function comOpcoes(): GtaFlowState {
  return run(initialGtaFlowState(INVENTORY), {
    type: "opcoesCarregadas",
    options: OPTIONS,
  });
}

function ateRevisao(informarExtras = false): GtaFlowState {
  let state = run(
    comOpcoes(),
    { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
    { type: "continuarAnimais" },
    { type: "buscarCpf", cpf: "12345678901" },
    { type: "destinosEncontrados", cpf: "12345678901", ueps: [DESTINO_UEP] },
    { type: "escolherUep", uep: DESTINO_UEP },
    { type: "continuarDatas" },
    { type: "responderExtras", informar: informarExtras },
  );

  if (informarExtras) {
    state = run(
      state,
      { type: "mudarNotaFiscal", valor: "123" },
      { type: "continuarNotaFiscal" },
      { type: "mudarPlaca", valor: "abc1d23" },
      { type: "continuarPlaca" },
    );
  }

  return state;
}

describe("opções da GTA", () => {
  it("preenche os padrões e as datas ao carregar", () => {
    const state = comOpcoes();

    expect(state.optionsBusy).toBe(false);
    expect(state.finalidade).toBe("ENGORDA");
    expect(state.transporte).toBe("RODOVIÁRIO");
    expect(state.dataSaida).toBe("2026-10-28");
    expect(state.dataValidade).toBe("2026-10-31");
  });

  it("mantém a falha visível e permite recarregar", () => {
    const state = run(initialGtaFlowState(INVENTORY), {
      type: "opcoesFalharam",
      mensagem: "SIGEN fora",
    });

    expect(state.options).toBeNull();
    expect(state.optionsBusy).toBe(false);
    expect(state.optionsError).toBe("SIGEN fora");
  });
});

describe("seleção e origem", () => {
  it("trava a origem no primeiro animal marcado", () => {
    let state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "selecionarAnimal", unitKey: OUTRA_ORIGEM, key: ANIMAL_C.key },
    );

    expect(state.selected.has(ANIMAL_A.key)).toBe(true);
    expect(state.selected.has(ANIMAL_C.key)).toBe(false);

    state = run(state, { type: "limparSelecao" });
    expect(state.selected.size).toBe(0);
  });

  it("continua para o CPF com o resumo da seleção", () => {
    const state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_B.key },
      { type: "continuarAnimais" },
    );

    expect(state.phase).toBe("cpf");
    expect(state.history.at(-2)?.text).toContain(
      "2 animais: Mimosa (067836), Brinco 069054",
    );
    expect(state.history.at(-1)?.text).toContain("Para quem vão os animais?");
  });
});

describe("voltar", () => {
  it("volta da revisão para extras", () => {
    const state = run(ateRevisao(), { type: "voltar" });

    expect(state.phase).toBe("extras");
    expect(state.confirmed).toBe(false);
    expect(state.history.at(-1)?.text).toBe("Voltar.");
  });

  it("volta de placa para nota fiscal", () => {
    const state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "continuarAnimais" },
      { type: "buscarCpf", cpf: "12345678901" },
      { type: "destinosEncontrados", cpf: "12345678901", ueps: [DESTINO_UEP] },
      { type: "escolherUep", uep: DESTINO_UEP },
      { type: "continuarDatas" },
      { type: "responderExtras", informar: true },
      { type: "continuarNotaFiscal" },
      { type: "voltar" },
    );

    expect(state.phase).toBe("notaFiscal");
    expect(state.history.at(-1)?.text).toBe("Qual o número da nota fiscal?");
  });

  it("volta da UEP para o CPF e limpa o destino", () => {
    const state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "continuarAnimais" },
      { type: "buscarCpf", cpf: "12345678901" },
      { type: "destinosEncontrados", cpf: "12345678901", ueps: [DESTINO_UEP] },
      { type: "voltar" },
    );

    expect(state.phase).toBe("cpf");
    expect(state.cpf).toBe("");
    expect(state.destinos).toEqual([]);
    expect(state.history.at(-1)?.text).toContain("Para quem vão os animais?");
  });

  it("volta do CPF para os animais", () => {
    const state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "continuarAnimais" },
      { type: "voltar" },
    );

    expect(state.phase).toBe("animais");
    expect(state.cpf).toBe("");
    expect(state.history.at(-1)?.text).toBe("Quais animais vão na GTA?");
  });
});

describe("nota fiscal e placa", () => {
  it("responde Não e vai direto para a revisão", () => {
    const state = run(ateRevisao(), { type: "voltar" }, {
      type: "responderExtras",
      informar: false,
    });

    expect(state.phase).toBe("revisao");
    expect(state.notaFiscal).toBe("");
    expect(state.placa).toBe("");
    expect(state.history.at(-2)?.text).toBe("Não.");
  });

  it("aceita nota e placa em branco", () => {
    const state = run(
      ateRevisao(true),
      { type: "voltar" }, // revisão -> extras
      { type: "responderExtras", informar: true },
      { type: "mudarNotaFiscal", valor: "" },
      { type: "continuarNotaFiscal" },
    );

    expect(state.phase).toBe("placa");
    expect(state.history.at(-2)?.text).toBe("Nota fiscal: em branco.");

    const final = run(
      state,
      { type: "mudarPlaca", valor: "" },
      { type: "continuarPlaca" },
    );
    expect(final.phase).toBe("revisao");
    expect(final.history.at(-2)?.text).toBe("Placa: em branco.");
  });

  it("normaliza a placa e limpa a confirmação ao editar", () => {
    const state = run(
      ateRevisao(true),
      { type: "confirmar", valor: true },
      { type: "mudarLacre", valor: "L1" },
    );

    expect(state.placa).toBe("ABC1D23");
    expect(state.confirmed).toBe(false);
  });
});

describe("datas", () => {
  it("recalcula a validade quando a saída muda", () => {
    const state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "continuarAnimais" },
      { type: "buscarCpf", cpf: "12345678901" },
      { type: "destinosEncontrados", cpf: "12345678901", ueps: [DESTINO_UEP] },
      { type: "escolherUep", uep: DESTINO_UEP },
      { type: "mudarSaida", valor: "2026-11-01" },
    );

    expect(state.dataSaida).toBe("2026-11-01");
    expect(state.dataValidade).toBe("2026-11-04");
    expect(state.phase).toBe("datas");
  });

  it("não avança com validade anterior à saída", () => {
    const state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "continuarAnimais" },
      { type: "buscarCpf", cpf: "12345678901" },
      { type: "destinosEncontrados", cpf: "12345678901", ueps: [DESTINO_UEP] },
      { type: "escolherUep", uep: DESTINO_UEP },
      { type: "mudarValidade", valor: "2026-10-27" },
      { type: "continuarDatas" },
    );

    expect(state.phase).toBe("datas");
  });
});

describe("CPF e destinos", () => {
  it("mascara o CPF no histórico", () => {
    const state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "continuarAnimais" },
      { type: "buscarCpf", cpf: "12345678901" },
    );

    expect(state.history.at(-1)?.text).toBe("CPF ***.***.***-01");
    expect(state.lookupBusy).toBe(true);
  });

  it("remove a própria origem da lista de destinos", () => {
    const state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "continuarAnimais" },
      { type: "buscarCpf", cpf: "12345678901" },
      { type: "destinosEncontrados", cpf: "12345678901", ueps: [DESTINO_UEP, UEP_ORIGEM] },
    );

    expect(state.destinos).toEqual([DESTINO_UEP]);
    expect(state.phase).toBe("uep");
  });

  it("fica no CPF quando não encontra propriedade", () => {
    const state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "continuarAnimais" },
      { type: "buscarCpf", cpf: "12345678901" },
      { type: "destinosEncontrados", cpf: "12345678901", ueps: [UEP_ORIGEM] },
    );

    expect(state.phase).toBe("cpf");
    expect(state.lookupBusy).toBe(false);
    expect(state.lookupError).toContain("Nenhuma propriedade bovina");
  });

  it("ignora a resposta de um CPF antigo", () => {
    const state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "continuarAnimais" },
      { type: "buscarCpf", cpf: "11111111111" },
      {
        type: "destinosEncontrados",
        cpf: "22222222222",
        ueps: [DESTINO_UEP],
      },
    );

    expect(state.phase).toBe("cpf");
    expect(state.destinos).toEqual([]);
  });

  it("valida CPF e CNPJ", () => {
    expect(parseDocumento("123.456.789-01")).toEqual({
      ok: true,
      digits: "12345678901",
    });
    expect(parseDocumento("12.345.678/0001-99")).toEqual({
      ok: true,
      digits: "12345678000199",
    });
    expect(parseDocumento("123")).toEqual({ ok: false });
  });
});

describe("emissão", () => {
  it("narra a emissão e entra no status", () => {
    const state = run(ateRevisao(), { type: "iniciar" });

    expect(state.phase).toBe("status");
    expect(state.starting).toBe(true);
    expect(state.jobId).toBeNull();
    expect(state.history.at(-1)?.text).toContain("Emitir GTA: 1 animal");
  });

  it("só permite iniciar na revisão ou no resultado", () => {
    expect(podeIniciar(ateRevisao())).toBe(true);
    expect(podeIniciar(comOpcoes())).toBe(false);
  });

  it("aceita o job e depois mostra o resultado", () => {
    let state = run(ateRevisao(), { type: "iniciar" });
    state = run(state, { type: "inicioAceito", id: 7 });
    expect(state.jobId).toBe(7);
    expect(state.starting).toBe(false);

    state = run(state, {
      type: "jobRecebido",
      job: job({ status: "emitida", numero: "000 1" }),
    });
    expect(state.phase).toBe("resultado");
    expect(resultadoDaGta(state).concluida).toBe(true);
    expect(state.destino).toBeNull();
  });

  it("não oferece retry para erro determinístico do job", () => {
    const state = run(
      ateRevisao(),
      { type: "iniciar" },
      {
        type: "jobRecebido",
        job: job({
          status: "erro",
          erro: "Não encontrei a propriedade.",
          codigo: "GTA_UEP_INVALIDA",
        }),
      },
    );

    expect(resultadoDaGta(state).podeTentarDeNovo).toBe(false);
  });

  it("registra a falha com o código da API", () => {
    const state = run(ateRevisao(), { type: "iniciar" }, {
      type: "inicioFalhou",
      mensagem: "Já foi emitida",
      codigo: "GTA_JA_EMITIDA",
    });

    expect(state.phase).toBe("resultado");
    expect(state.starting).toBe(false);
    expect(state.resultCode).toBe("GTA_JA_EMITIDA");
    expect(resultadoDaGta(state).podeTentarDeNovo).toBe(false);
  });
});

describe("incerta", () => {
  it("mantém o destino para permitir nova tentativa", () => {
    let state = run(ateRevisao(), { type: "iniciar" }, {
      type: "jobRecebido",
      job: job({ status: "incerta", erro: "Confira no SIGEN." }),
    });

    expect(state.phase).toBe("resultado");
    expect(state.destino).not.toBeNull();
    expect(resultadoDaGta(state).incerta).toBe(true);

    state = run(state, {
      type: "jobResolvido",
      job: job({ status: "nao_emitida" }),
    });
    expect(resultadoDaGta(state).podeTentarDeNovo).toBe(true);
    expect(state.history.length).toBeGreaterThan(0);

    state = run(state, { type: "iniciar" });
    expect(state.phase).toBe("status");
  });

  it("limpa o destino quando o produtor confirma que foi emitida", () => {
    const state = run(
      ateRevisao(),
      { type: "iniciar" },
      { type: "jobRecebido", job: job({ status: "incerta" }) },
      { type: "jobResolvido", job: job({ status: "emitida", numero: "000 9" }) },
    );

    expect(state.destino).toBeNull();
    expect(state.resultCode).toBe("");
    expect(resultadoDaGta(state).podeTentarDeNovo).toBe(false);
  });

  it("mostra a GTA anterior quando o início é bloqueado", () => {
    const state = run(
      ateRevisao(),
      { type: "iniciar" },
      {
        type: "inicioFalhou",
        mensagem: "A última tentativa ficou incerta.",
        codigo: "GTA_INCERTA",
      },
      { type: "jobRecebido", job: job({ status: "incerta" }) },
    );

    expect(state.phase).toBe("resultado");
    expect(state.job?.status).toBe("incerta");
    expect(resultadoDaGta(state).incerta).toBe(true);
  });
});

describe("cancelar", () => {
  it("cancela, ignora eventos atrasados e permite reiniciar", () => {
    let state = run(
      comOpcoes(),
      { type: "selecionarAnimal", unitKey: ORIGEM, key: ANIMAL_A.key },
      { type: "continuarAnimais" },
      { type: "buscarCpf", cpf: "12345678901" },
      { type: "cancelar" },
    );

    expect(state.phase).toBe("cancelado");
    expect(state.cpf).toBe("");

    const atrasado = run(state, {
      type: "destinosEncontrados",
      cpf: "12345678901",
      ueps: [DESTINO_UEP],
    });
    expect(atrasado.phase).toBe("cancelado");

    state = run(atrasado, { type: "reiniciar" });
    expect(state.destino).toBeNull();
  });
});

describe("títulos do cartão", () => {
  it("descreve cada fase", () => {
    expect(tituloDoCartao("animais")).toBe("Animais");
    expect(tituloDoCartao("cpf")).toBe("Destino");
    expect(tituloDoCartao("resultado")).toBe("Resultado");
    expect(tituloDoCartao("cancelado")).toBe("Cancelada");
  });
});
