import { describe, expect, it } from "vitest";
import { createInventoryService } from "./inventory.js";
import { SigenError, type Inventory } from "./sigen/types.js";

const INVENTARIO: Inventory = {
  buscadoEm: "2026-10-28T10:00:00.000Z",
  total: 0,
  propriedades: [],
  avisos: [],
};

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("job do inventário", () => {
  it("devolve o id, publica o progresso e conclui", async () => {
    let concluir: ((value: Inventory) => void) | null = null;
    let progresso: ((atual: number, total: number) => void) | null = null;

    const service = createInventoryService({
      load: (onProgress) => {
        progresso = onProgress ?? null;
        return new Promise((resolve) => {
          concluir = resolve;
        });
      },
    });

    const { id } = service.start();
    expect(service.get(id)).toMatchObject({
      status: "buscando",
      etapa: "conectando",
    });

    progresso?.(1, 3);
    expect(service.get(id)).toMatchObject({
      etapa: "animais",
      atual: 1,
      total: 3,
    });

    concluir?.(INVENTARIO);
    await flush();

    expect(service.get(id)).toMatchObject({
      status: "pronto",
      etapa: "concluido",
      inventario: INVENTARIO,
    });
  });

  it("reaproveita a consulta em andamento e só cria outra depois de pronta", async () => {
    const concluir: Array<(value: Inventory) => void> = [];
    const service = createInventoryService({
      load: () =>
        new Promise((resolve) => {
          concluir.push(resolve);
        }),
    });

    const primeiro = service.start();
    const segundo = service.start();
    expect(segundo.id).toBe(primeiro.id);

    concluir[0]?.(INVENTARIO);
    await flush();
    expect(service.get(primeiro.id)?.status).toBe("pronto");

    const terceiro = service.start();
    expect(terceiro.id).not.toBe(primeiro.id);
  });

  it("expõe o erro e o código do SIGEN", async () => {
    const service = createInventoryService({
      load: async () => {
        throw new SigenError("PDF_LAYOUT_MUDOU", "O PDF mudou.");
      },
    });

    const { id } = service.start();
    await flush();

    expect(service.get(id)).toMatchObject({
      status: "erro",
      codigo: "PDF_LAYOUT_MUDOU",
      erro: "O PDF mudou.",
    });
  });

  it("mascara CPF formatado na mensagem de erro", async () => {
    const service = createInventoryService({
      load: async () => {
        throw new SigenError(
          "SIGEN_ERRO",
          "A consulta do CPF 123.456.789-01 foi recusada.",
        );
      },
    });

    const { id } = service.start();
    await flush();

    expect(service.get(id)?.erro).toBe(
      "A consulta do CPF ***.***.***-01 foi recusada.",
    );
  });

  it("devolve null para consulta desconhecida", () => {
    const service = createInventoryService({
      load: async () => INVENTARIO,
    });

    expect(service.get(999)).toBeNull();
  });
});
