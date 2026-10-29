import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openAnimalStore } from "./db.js";

describe("openAnimalStore", () => {
  it("grava, lê e remove apelidos", () => {
    const store = openAnimalStore(":memory:");

    store.setNickname("076000003067836", "Mimosa");
    store.setNickname("076000003069054", "Estrela");
    expect(store.nicknames()).toEqual(
      new Map([
        ["076000003067836", "Mimosa"],
        ["076000003069054", "Estrela"],
      ]),
    );

    store.setNickname("076000003067836", "Mimosinha");
    expect(store.nicknames().get("076000003067836")).toBe("Mimosinha");

    store.removeNickname("076000003069054");
    expect(store.nicknames().has("076000003069054")).toBe(false);

    store.close();
  });

  it("guarda a versão da foto e sempre avança", () => {
    const store = openAnimalStore(":memory:");
    const chave = "076000003067836";

    expect(store.photoVersion(chave)).toBeNull();

    const primeira = store.setPhoto(chave, 1234);
    expect(store.photoVersion(chave)).toBe(primeira);
    expect(store.photoVersions().get(chave)).toBe(primeira);

    const segunda = store.setPhoto(chave, 4321);
    expect(segunda).toBeGreaterThan(primeira);
    expect(store.photoVersions().get(chave)).toBe(segunda);

    store.removePhoto(chave);
    expect(store.photoVersion(chave)).toBeNull();
    expect(store.photoVersions().size).toBe(0);

    store.close();
  });

  it("grava, atualiza e lista GTA", () => {
    const store = openAnimalStore(":memory:");

    const id = store.createGta({
      status: "preparando",
      modo: "emitir",
      identidade: "viagem-1",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000261071",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      animais: ["076000003067836", "076000003069054"],
    });

    const created = store.getGta(id);
    expect(created?.status).toBe("preparando");
    expect(created?.animais).toEqual([
      "076000003067836",
      "076000003069054",
    ]);
    expect(created?.numero).toBeNull();

    store.updateGta(id, {
      status: "emitida",
      numero: "000 123456",
      pdfPath: "/tmp/gta.pdf",
    });

    const updated = store.getGta(id);
    expect(updated?.status).toBe("emitida");
    expect(updated?.numero).toBe("000 123456");
    expect(updated?.pdfPath).toBe("/tmp/gta.pdf");
    expect(store.listGtas(10)).toHaveLength(1);

    store.close();
  });

  it("reserva a viagem uma vez e devolve o registro que bloqueou", () => {
    const store = openAnimalStore(":memory:");
    const viagem = {
      status: "preparando" as const,
      modo: "emitir" as const,
      identidade: "viagem-1",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000261071",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      animais: ["076000003067836"],
    };

    const first = store.criarGtaSeLivre(viagem);
    expect(first.ok).toBe(true);

    const second = store.criarGtaSeLivre(viagem);
    expect(second).toMatchObject({
      ok: false,
      motivo: "viagem",
      existente: { identidade: "viagem-1" },
    });

    if (!first.ok) throw new Error("a primeira reserva deveria passar");
    store.updateGta(first.id, { status: "nao_emitida" });
    expect(store.criarGtaSeLivre(viagem).ok).toBe(true);

    store.close();
  });

  it("bloqueia animal que já está em outra GTA do mesmo dia", () => {
    const store = openAnimalStore(":memory:");
    store.createGta({
      status: "emitida",
      modo: "emitir",
      identidade: "outra-viagem",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000261071",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      animais: ["076000003067836"],
    });

    const sobreposta = store.criarGtaSeLivre({
      status: "preparando",
      modo: "emitir",
      identidade: "viagem-2",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000311195",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      animais: ["076000003067836", "076000003069054"],
    });
    expect(sobreposta).toMatchObject({
      ok: false,
      motivo: "animal",
      existente: { identidade: "outra-viagem" },
    });

    const outroDia = store.criarGtaSeLivre({
      status: "preparando",
      modo: "emitir",
      identidade: "viagem-3",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000311195",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-26",
      dataValidade: "2026-10-29",
      animais: ["076000003067836"],
    });
    expect(outroDia.ok).toBe(true);

    store.close();
  });

  it("não bloqueia viagem cuja tentativa terminou em erro", () => {
    const store = openAnimalStore(":memory:");
    const base = {
      status: "erro" as const,
      modo: "emitir" as const,
      identidade: "viagem-1",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000261071",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      animais: ["076000003067836"],
    };

    store.createGta(base);
    expect(store.criarGtaSeLivre({ ...base, status: "preparando" }).ok).toBe(
      true,
    );

    store.close();
  });

  it("conferência não bloqueia a emissão da mesma viagem", () => {
    const store = openAnimalStore(":memory:");
    const base = {
      status: "preparando" as const,
      modo: "emitir" as const,
      identidade: "viagem-1",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000261071",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      animais: ["076000003067836"],
    };

    store.createGta({ ...base, modo: "conferir" });
    expect(store.criarGtaSeLivre(base).ok).toBe(true);

    store.close();
  });

  it("recupera conferência interrompida como erro, não como incerta", () => {
    const store = openAnimalStore(":memory:");
    const id = store.createGta({
      status: "preparando",
      modo: "conferir",
      identidade: "viagem-1",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000261071",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      animais: ["076000003067836"],
    });

    store.recoverStaleGtas(
      new Date(Date.now() + 1000).toISOString(),
      "Interrompido.",
    );

    const recovered = store.getGta(id);
    expect(recovered?.status).toBe("erro");
    expect(recovered?.erro).toContain("Nada foi emitido");

    store.close();
  });

  it("migra banco antigo de hash para identidade e modo", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sigen-db-"));
    const file = path.join(dir, "sigen.db");
    const legacy = new Database(file);
    legacy.exec(`
      CREATE TABLE gta_emissoes (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        status         TEXT NOT NULL,
        hash           TEXT NOT NULL,
        origem_codigo  TEXT NOT NULL,
        origem_uep     TEXT NOT NULL,
        destino_codigo TEXT NOT NULL,
        destino_uep    TEXT NOT NULL,
        finalidade     TEXT NOT NULL,
        data_saida     TEXT NOT NULL,
        data_validade  TEXT NOT NULL,
        animais        TEXT NOT NULL,
        numero         TEXT,
        pdf_path       TEXT,
        erro           TEXT,
        criada_em      TEXT NOT NULL,
        atualizada_em  TEXT NOT NULL
      );
      INSERT INTO gta_emissoes (
        status, hash, origem_codigo, origem_uep, destino_codigo, destino_uep,
        finalidade, data_saida, data_validade, animais, criada_em, atualizada_em
      ) VALUES (
        'emitida', 'hash-antigo', '42-000165623', '1', '42-000261071', '1',
        'ENGORDA', '2026-10-25', '2026-10-28', '["076000003067836"]',
        '2026-10-25T10:00:00.000Z', '2026-10-25T10:01:00.000Z'
      );
    `);
    legacy.close();

    const store = openAnimalStore(file);
    const record = store.getGta(1);
    expect(record?.identidade).toBe("hash-antigo");
    expect(record?.modo).toBe("emitir");
    expect(record?.codigo).toBeNull();
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("recupera GTA travada como incerta", () => {
    const store = openAnimalStore(":memory:");
    const id = store.createGta({
      status: "salvando",
      modo: "emitir",
      identidade: "viagem-1",
      origemCodigo: "42-000165623",
      origemUep: "1",
      destinoCodigo: "42-000261071",
      destinoUep: "1",
      finalidade: "ENGORDA",
      dataSaida: "2026-10-25",
      dataValidade: "2026-10-28",
      animais: ["076000003067836"],
    });

    const changed = store.recoverStaleGtas(
      new Date(Date.now() + 1000).toISOString(),
      "Interrompido.",
    );
    expect(changed).toBe(1);

    const recovered = store.getGta(id);
    expect(recovered?.status).toBe("incerta");
    expect(recovered?.erro).toBe("Interrompido.");

    store.close();
  });
});
