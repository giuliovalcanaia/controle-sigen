import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Dados que são nossos, não do SIGEN: apelidos e versão das fotos.
 * A chave é sempre o Nº Brinco oficial (15 dígitos), nunca o manejo.
 */
export type AnimalStore = {
  nicknames(): Map<string, string>;
  setNickname(animalKey: string, apelido: string): void;
  removeNickname(animalKey: string): void;
  photoVersions(): Map<string, number>;
  photoVersion(animalKey: string): number | null;
  setPhoto(animalKey: string, bytes: number): number;
  removePhoto(animalKey: string): void;
  close(): void;
};

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
    close() {
      db.close();
    },
  };
}
