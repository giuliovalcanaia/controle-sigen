import { describe, expect, it } from "vitest";
import { collectUepIds, collectUeps } from "./uep.js";

describe("collectUepIds", () => {
  it("encontra IDs no formato real da API", () => {
    const body = {
      success: true,
      data: {
        listaPropriedade: [{ propriedade: { idPropriedade: 10 } }],
        listaUep: [
          { idUnidadeExploracao: 123, propriedade: { idPropriedade: 10 } },
          { idUnidadeExploracao: 456, propriedade: { idPropriedade: 11 } },
        ],
      },
    };

    expect(collectUepIds(body)).toEqual(["123", "456"]);
  });

  it("aceita números, strings e nomes alternativos", () => {
    const body = {
      itens: [
        { IdUnidadeExploracao: "7" },
        { idUnidadeExploracao: 8 },
        { idUnidadeExploracaoUep: 9 },
      ],
    };
    expect(collectUepIds(body)).toEqual(["7", "8", "9"]);
  });

  it("remove duplicatas e ignora valores vazios", () => {
    const body = {
      listaUep: [
        { idUnidadeExploracao: 42 },
        { idUnidadeExploracao: "42" },
        { idUnidadeExploracao: "" },
        { idUnidadeExploracao: null },
      ],
    };
    expect(collectUepIds(body)).toEqual(["42"]);
  });

  it("retorna vazio quando só há idPropriedade", () => {
    expect(collectUepIds({ listaPropriedade: [{ propriedade: { idPropriedade: 1 } }] })).toEqual([]);
  });

  it("não entra em loop com referência circular", () => {
    const body: Record<string, unknown> = { idUnidadeExploracao: 1 };
    body.self = body;
    expect(collectUepIds(body)).toEqual(["1"]);
  });

  it("extrai a espécie de cada UEP", () => {
    const body = {
      data: {
        listaUep: [
          { idUnidadeExploracao: 10, especieAnimal: { nmEspecieAnimal: "BOVINO" } },
          { idUnidadeExploracao: 11, especieAnimal: { nmEspecieAnimal: "SUINO" } },
          { idUnidadeExploracao: 12 },
        ],
      },
    };

    expect(collectUeps(body)).toEqual([
      { id: "10", especie: "BOVINO" },
      { id: "11", especie: "SUINO" },
      { id: "12", especie: null },
    ]);
  });

  it("prefere a entrada que traz a espécie quando o ID se repete", () => {
    const body = {
      data: {
        listaUep: [
          { idUnidadeExploracao: 10 },
          { idUnidadeExploracao: 10, especieAnimal: { nmEspecieAnimal: "BOVINO" } },
        ],
      },
    };
    expect(collectUeps(body)).toEqual([{ id: "10", especie: "BOVINO" }]);
  });
});
