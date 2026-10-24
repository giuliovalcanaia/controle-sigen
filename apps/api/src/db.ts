import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type NicknameStore = {
  all(): Map<string, string>;
  set(animalKey: string, apelido: string): void;
  remove(animalKey: string): void;
  close(): void;
};

type NicknameRow = {
  animal_key: string;
  apelido: string;
};

export function openNicknameStore(filename: string): NicknameStore {
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
  `);

  const selectAll = db.prepare<[], NicknameRow>(
    "SELECT animal_key, apelido FROM nicknames",
  );
  const upsert = db.prepare(
    `INSERT INTO nicknames (animal_key, apelido, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(animal_key) DO UPDATE SET
       apelido = excluded.apelido,
       updated_at = excluded.updated_at`,
  );
  const remove = db.prepare("DELETE FROM nicknames WHERE animal_key = ?");

  return {
    all() {
      const map = new Map<string, string>();
      for (const row of selectAll.all()) map.set(row.animal_key, row.apelido);
      return map;
    },
    set(animalKey, apelido) {
      upsert.run(animalKey, apelido, new Date().toISOString());
    },
    remove(animalKey) {
      remove.run(animalKey);
    },
    close() {
      db.close();
    },
  };
}
