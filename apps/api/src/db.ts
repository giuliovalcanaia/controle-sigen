import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { GTA_STATUS_BLOQUEANTES, type GtaStatus } from "./gta/types.js";

/**
 * Dados que são nossos, não do SIGEN: apelidos, versão das fotos e o
 * histórico de GTAs emitidas.
 * A chave do animal é sempre o Nº Brinco oficial (15 dígitos), nunca o manejo.
 */
export type AnimalStore = {
  nicknames(): Map<string, string>;
  setNickname(animalKey: string, apelido: string): void;
  removeNickname(animalKey: string): void;
  photoVersions(): Map<string, number>;
  photoVersion(animalKey: string): number | null;
  setPhoto(animalKey: string, bytes: number): number;
  removePhoto(animalKey: string): void;
  createGta(input: NewGta): number;
  /**
   * Cria a GTA só se a viagem (e os animais dela) não estiver bloqueada.
   * A checagem e o `INSERT` acontecem na mesma transação síncrona: dois
   * pedidos simultâneos não conseguem passar juntos.
   */
  criarGtaSeLivre(input: NewGta): ClaimGtaResult;
  /** Só atualiza se a GTA ainda estiver incerta. */
  resolverIncerteza(
    id: number,
    patch: { status: GtaStatus; numero: string | null; erro: string | null },
  ): boolean;
  updateGta(id: number, patch: GtaPatch): void;
  getGta(id: number): GtaRecord | null;
  listGtas(limit: number): GtaRecord[];
  recoverStaleGtas(beforeIso: string, message: string): number;
  close(): void;
};

export type ClaimGtaResult =
  | { ok: true; id: number }
  | { ok: false; motivo: "viagem" | "animal"; existente: GtaRecord };

export type NewGta = {
  status: GtaStatus;
  /** Conferência não reserva a viagem; só a emissão bloqueia. */
  modo: "conferir" | "emitir";
  /** Hash da viagem: origem + animais + data de saída. */
  identidade: string;
  origemCodigo: string;
  origemUep: string;
  destinoCodigo: string;
  destinoUep: string;
  finalidade: string;
  dataSaida: string;
  dataValidade: string;
  /** Brincos oficiais, em ordem. */
  animais: string[];
  /** Código do último erro do job, para a UI decidir se vale retentar. */
  codigo?: string | null;
};

export type GtaPatch = {
  status?: GtaStatus;
  numero?: string | null;
  pdfPath?: string | null;
  erro?: string | null;
  codigo?: string | null;
};

export type GtaRecord = {
  id: number;
  status: GtaStatus;
  modo: "conferir" | "emitir";
  identidade: string;
  origemCodigo: string;
  origemUep: string;
  destinoCodigo: string;
  destinoUep: string;
  finalidade: string;
  dataSaida: string;
  dataValidade: string;
  animais: string[];
  numero: string | null;
  pdfPath: string | null;
  erro: string | null;
  codigo: string | null;
  criadaEm: string;
  atualizadaEm: string;
};

type GtaRow = {
  id: number;
  status: GtaStatus;
  modo: "conferir" | "emitir";
  identidade: string;
  origem_codigo: string;
  origem_uep: string;
  destino_codigo: string;
  destino_uep: string;
  finalidade: string;
  data_saida: string;
  data_validade: string;
  animais: string;
  numero: string | null;
  pdf_path: string | null;
  erro: string | null;
  codigo: string | null;
  criada_em: string;
  atualizada_em: string;
};

function toGta(row: GtaRow): GtaRecord {
  let animais: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.animais);
    if (Array.isArray(parsed)) {
      animais = parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    animais = [];
  }

  return {
    id: row.id,
    status: row.status,
    modo: row.modo,
    identidade: row.identidade,
    origemCodigo: row.origem_codigo,
    origemUep: row.origem_uep,
    destinoCodigo: row.destino_codigo,
    destinoUep: row.destino_uep,
    finalidade: row.finalidade,
    dataSaida: row.data_saida,
    dataValidade: row.data_validade,
    animais,
    numero: row.numero,
    pdfPath: row.pdf_path,
    erro: row.erro,
    codigo: row.codigo ?? null,
    criadaEm: row.criada_em,
    atualizadaEm: row.atualizada_em,
  };
}

type NicknameRow = {
  animal_key: string;
  apelido: string;
};

type PhotoRow = {
  animal_key: string;
  version: number;
};

export function openAnimalStore(filename: string): AnimalStore {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS nicknames (
      animal_key TEXT PRIMARY KEY,
      apelido    TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      animal_key TEXT PRIMARY KEY,
      version    INTEGER NOT NULL,
      bytes      INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gta_emissoes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      status         TEXT NOT NULL,
      modo           TEXT NOT NULL DEFAULT 'emitir',
      identidade     TEXT NOT NULL,
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
      codigo         TEXT,
      criada_em      TEXT NOT NULL,
      atualizada_em  TEXT NOT NULL
    );
  `);

  // Bancos criados antes da política de emissão guardavam o hash da viagem
  // numa coluna chamada `hash`. Os valores antigos não colidem com as
  // identidades novas, mas a coluna precisa do nome do domínio.
  const gtaColumns = db
    .prepare("PRAGMA table_info(gta_emissoes)")
    .all() as Array<{ name: string }>;
  if (
    !gtaColumns.some((column) => column.name === "identidade") &&
    gtaColumns.some((column) => column.name === "hash")
  ) {
    db.exec("ALTER TABLE gta_emissoes RENAME COLUMN hash TO identidade");
    db.exec("DROP INDEX IF EXISTS idx_gta_hash");
  }

  // Bancos antigos não distinguiam conferência de emissão. `conferida` é a
  // única evidência de conferência que sobrou; o resto entra como emissão.
  if (!gtaColumns.some((column) => column.name === "modo")) {
    db.exec(
      "ALTER TABLE gta_emissoes ADD COLUMN modo TEXT NOT NULL DEFAULT 'emitir'",
    );
    db.exec(
      "UPDATE gta_emissoes SET modo = 'conferir' WHERE status = 'conferida'",
    );
  }

  if (!gtaColumns.some((column) => column.name === "codigo")) {
    db.exec("ALTER TABLE gta_emissoes ADD COLUMN codigo TEXT");
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_gta_identidade
      ON gta_emissoes (identidade, criada_em);
    CREATE INDEX IF NOT EXISTS idx_gta_status
      ON gta_emissoes (status, atualizada_em);
    CREATE INDEX IF NOT EXISTS idx_gta_data
      ON gta_emissoes (data_saida, status);
  `);

  const selectNicknames = db.prepare<[], NicknameRow>(
    "SELECT animal_key, apelido FROM nicknames",
  );
  const upsertNickname = db.prepare(
    `INSERT INTO nicknames (animal_key, apelido, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(animal_key) DO UPDATE SET
       apelido = excluded.apelido,
       updated_at = excluded.updated_at`,
  );
  const deleteNickname = db.prepare("DELETE FROM nicknames WHERE animal_key = ?");

  const selectPhotoVersions = db.prepare<[], PhotoRow>(
    "SELECT animal_key, version FROM photos",
  );
  const selectPhotoVersion = db.prepare<[string], PhotoRow>(
    "SELECT animal_key, version FROM photos WHERE animal_key = ?",
  );
  const upsertPhoto = db.prepare(
    `INSERT INTO photos (animal_key, version, bytes, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(animal_key) DO UPDATE SET
       version = excluded.version,
       bytes = excluded.bytes,
       updated_at = excluded.updated_at`,
  );
  const deletePhoto = db.prepare("DELETE FROM photos WHERE animal_key = ?");

  const insertGta = db.prepare(
    `INSERT INTO gta_emissoes (
       status, modo, identidade, origem_codigo, origem_uep, destino_codigo,
       destino_uep, finalidade, data_saida, data_validade, animais, codigo,
       criada_em, atualizada_em
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectGta = db.prepare<[number], GtaRow>(
    "SELECT * FROM gta_emissoes WHERE id = ?",
  );
  const selectGtas = db.prepare<[number], GtaRow>(
    "SELECT * FROM gta_emissoes ORDER BY id DESC LIMIT ?",
  );
  const selectBloqueantes = db.prepare<[string, ...GtaStatus[]], GtaRow>(
    `SELECT * FROM gta_emissoes
     WHERE data_saida = ? AND modo = 'emitir'
       AND status IN (${GTA_STATUS_BLOQUEANTES.map(() => "?").join(", ")})
     ORDER BY id DESC`,
  );
  const recoverGtas = db.prepare(
    `UPDATE gta_emissoes
     SET status = CASE WHEN modo = 'emitir' THEN 'incerta' ELSE 'erro' END,
         erro = CASE
           WHEN modo = 'emitir' THEN ?
           ELSE 'A conferência foi interrompida. Nada foi emitido.'
         END,
         atualizada_em = ?
     WHERE status IN ('preparando', 'preenchendo', 'salvando')
       AND atualizada_em < ?`,
  );
  const resolveIncerteza = db.prepare(
    `UPDATE gta_emissoes
     SET status = ?, numero = ?, erro = ?, codigo = NULL, atualizada_em = ?
     WHERE id = ? AND status = 'incerta'`,
  );

  function insert(input: NewGta): number {
    const now = new Date().toISOString();
    const result = insertGta.run(
      input.status,
      input.modo,
      input.identidade,
      input.origemCodigo,
      input.origemUep,
      input.destinoCodigo,
      input.destinoUep,
      input.finalidade,
      input.dataSaida,
      input.dataValidade,
      JSON.stringify(input.animais),
      input.codigo ?? null,
      now,
      now,
    );
    return Number(result.lastInsertRowid);
  }

  /**
   * Checagem e inserção na mesma transação síncrona do `better-sqlite3`: o
   * event loop não intercala outro pedido entre o `SELECT` e o `INSERT`.
   * Chamado com `immediate`, pega o lock de escrita antes de ler.
   */
  const claimGta = db.transaction((input: NewGta): ClaimGtaResult => {
    const bloqueantes = selectBloqueantes
      .all(input.dataSaida, ...GTA_STATUS_BLOQUEANTES)
      .map(toGta);

    const mesmaViagem = bloqueantes.find(
      (record) => record.identidade === input.identidade,
    );
    if (mesmaViagem) {
      return { ok: false, motivo: "viagem", existente: mesmaViagem };
    }

    const animais = new Set(input.animais);
    const animalSobreposto = bloqueantes.find((record) =>
      record.animais.some((key) => animais.has(key)),
    );
    if (animalSobreposto) {
      return { ok: false, motivo: "animal", existente: animalSobreposto };
    }

    return { ok: true, id: insert(input) };
  });

  return {
    nicknames() {
      const map = new Map<string, string>();
      for (const row of selectNicknames.all()) map.set(row.animal_key, row.apelido);
      return map;
    },
    setNickname(animalKey, apelido) {
      upsertNickname.run(animalKey, apelido, new Date().toISOString());
    },
    removeNickname(animalKey) {
      deleteNickname.run(animalKey);
    },
    photoVersions() {
      const map = new Map<string, number>();
      for (const row of selectPhotoVersions.all()) map.set(row.animal_key, row.version);
      return map;
    },
    photoVersion(animalKey) {
      return selectPhotoVersion.get(animalKey)?.version ?? null;
    },
    setPhoto(animalKey, bytes) {
      // A versão entra na URL (?v=...) e derruba o cache do navegador
      // quando a foto é trocada. Precisa ser sempre maior que a anterior.
      const previous = selectPhotoVersion.get(animalKey)?.version ?? 0;
      const version = Math.max(Date.now(), previous + 1);
      upsertPhoto.run(animalKey, version, bytes, new Date(version).toISOString());
      return version;
    },
    removePhoto(animalKey) {
      deletePhoto.run(animalKey);
    },
    createGta(input) {
      return insert(input);
    },
    criarGtaSeLivre(input) {
      // `immediate` pega o lock de escrita antes do SELECT: mesmo com dois
      // processos no mesmo arquivo, ninguém lê antes do INSERT do outro.
      return claimGta.immediate(input);
    },
    resolverIncerteza(id, patch) {
      const result = resolveIncerteza.run(
        patch.status,
        patch.numero,
        patch.erro,
        new Date().toISOString(),
        id,
      );
      return result.changes > 0;
    },
    updateGta(id, patch) {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (patch.status !== undefined) {
        fields.push("status = ?");
        values.push(patch.status);
      }
      if (patch.numero !== undefined) {
        fields.push("numero = ?");
        values.push(patch.numero);
      }
      if (patch.pdfPath !== undefined) {
        fields.push("pdf_path = ?");
        values.push(patch.pdfPath);
      }
      if (patch.erro !== undefined) {
        fields.push("erro = ?");
        values.push(patch.erro);
      }
      if (patch.codigo !== undefined) {
        fields.push("codigo = ?");
        values.push(patch.codigo);
      }
      if (fields.length === 0) return;

      fields.push("atualizada_em = ?");
      values.push(new Date().toISOString());
      values.push(id);

      db.prepare(
        `UPDATE gta_emissoes SET ${fields.join(", ")} WHERE id = ?`,
      ).run(...values);
    },
    getGta(id) {
      const row = selectGta.get(id);
      return row ? toGta(row) : null;
    },
    listGtas(limit) {
      const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
      return selectGtas.all(safeLimit).map(toGta);
    },
    recoverStaleGtas(beforeIso, message) {
      const result = recoverGtas.run(message, new Date().toISOString(), beforeIso);
      return result.changes;
    },
    close() {
      db.close();
    },
  };
}
