import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { GtaStatus } from "./gta/types.js";

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
  updateGta(id: number, patch: GtaPatch): void;
  getGta(id: number): GtaRecord | null;
  listGtas(limit: number): GtaRecord[];
  findRecentGta(
    hash: string,
    statuses: GtaStatus[],
    sinceIso: string,
  ): GtaRecord | null;
  recoverStaleGtas(beforeIso: string, message: string): number;
  close(): void;
};

export type NewGta = {
  status: GtaStatus;
  hash: string;
  origemCodigo: string;
  origemUep: string;
  destinoCodigo: string;
  destinoUep: string;
  finalidade: string;
  dataSaida: string;
  dataValidade: string;
  /** Brincos oficiais, em ordem. */
  animais: string[];
};

export type GtaPatch = {
  status?: GtaStatus;
  numero?: string | null;
  pdfPath?: string | null;
  erro?: string | null;
};

export type GtaRecord = {
  id: number;
  status: GtaStatus;
  hash: string;
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
  criadaEm: string;
  atualizadaEm: string;
};

type GtaRow = {
  id: number;
  status: GtaStatus;
  hash: string;
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
    hash: row.hash,
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

    CREATE INDEX IF NOT EXISTS idx_gta_hash
      ON gta_emissoes (hash, criada_em);
    CREATE INDEX IF NOT EXISTS idx_gta_status
      ON gta_emissoes (status, atualizada_em);
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
       status, hash, origem_codigo, origem_uep, destino_codigo, destino_uep,
       finalidade, data_saida, data_validade, animais, criada_em, atualizada_em
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectGta = db.prepare<[number], GtaRow>(
    "SELECT * FROM gta_emissoes WHERE id = ?",
  );
  const selectGtas = db.prepare<[number], GtaRow>(
    "SELECT * FROM gta_emissoes ORDER BY id DESC LIMIT ?",
  );
  const recoverGtas = db.prepare(
    `UPDATE gta_emissoes
     SET status = 'incerta', erro = ?, atualizada_em = ?
     WHERE status IN ('preparando', 'preenchendo', 'salvando')
       AND atualizada_em < ?`,
  );

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
      const now = new Date().toISOString();
      const result = insertGta.run(
        input.status,
        input.hash,
        input.origemCodigo,
        input.origemUep,
        input.destinoCodigo,
        input.destinoUep,
        input.finalidade,
        input.dataSaida,
        input.dataValidade,
        JSON.stringify(input.animais),
        now,
        now,
      );
      return Number(result.lastInsertRowid);
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
    findRecentGta(hash, statuses, sinceIso) {
      if (statuses.length === 0) return null;
      const placeholders = statuses.map(() => "?").join(", ");
      const row = db
        .prepare(
          `SELECT * FROM gta_emissoes
           WHERE hash = ? AND status IN (${placeholders}) AND criada_em >= ?
           ORDER BY id DESC LIMIT 1`,
        )
        .get(hash, ...statuses, sinceIso) as GtaRow | undefined;
      return row ? toGta(row) : null;
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
