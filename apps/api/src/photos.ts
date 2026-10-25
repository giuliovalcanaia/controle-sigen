import fs from "node:fs";
import path from "node:path";
import type { AnimalStore } from "./db.js";

/** Todo JPEG começa com FF D8 FF. Validar evita guardar outra coisa como foto. */
export function isJpeg(buffer: Buffer): boolean {
  return (
    buffer.length > 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

export type PhotoStore = {
  save(animalKey: string, buffer: Buffer): number;
  read(animalKey: string): { data: Buffer; version: number } | null;
  remove(animalKey: string): void;
};

/**
 * Fotos ficam em disco (data/fotos/<brinco oficial>.jpg) e a versão no
 * SQLite. O diretório fica dentro do volume `data`, junto dos apelidos.
 */
export function openPhotoStore(dir: string, animals: AnimalStore): PhotoStore {
  fs.mkdirSync(dir, { recursive: true });

  const fileFor = (animalKey: string) => path.join(dir, `${animalKey}.jpg`);

  return {
    save(animalKey, buffer) {
      const target = fileFor(animalKey);
      const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(temp, buffer);
      try {
        fs.renameSync(temp, target);
      } catch (error) {
        fs.rmSync(temp, { force: true });
        throw error;
      }
      return animals.setPhoto(animalKey, buffer.byteLength);
    },

    read(animalKey) {
      const version = animals.photoVersion(animalKey);
      if (version === null) return null;

      try {
        return { data: fs.readFileSync(fileFor(animalKey)), version };
      } catch {
        // Arquivo sumiu (backup restaurado pela metade): limpa a linha órfã.
        animals.removePhoto(animalKey);
        return null;
      }
    },

    remove(animalKey) {
      animals.removePhoto(animalKey);
      fs.rmSync(fileFor(animalKey), { force: true });
    },
  };
}
