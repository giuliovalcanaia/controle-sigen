import fs from "node:fs";
import path from "node:path";

/**
 * PDFs das GTAs emitidas. Ficam em `data/gta/<id>.pdf`, fora do git e da
 * imagem Docker, com permissão 600 porque contêm CPF, endereço e telefone.
 */
export type GtaPdfStore = {
  dir: string;
  save(id: number, bytes: Buffer): string;
  read(id: number): Buffer | null;
  remove(id: number): void;
};

export function isPdf(bytes: Buffer): boolean {
  return bytes.length > 4 && bytes.subarray(0, 4).toString("latin1") === "%PDF";
}

export function openGtaPdfStore(dir: string): GtaPdfStore {
  fs.mkdirSync(dir, { recursive: true });

  const file = (id: number) => path.join(dir, `${id}.pdf`);

  return {
    dir,
    save(id, bytes) {
      if (!isPdf(bytes)) {
        throw new Error("O SIGEN não devolveu um PDF.");
      }
      const target = file(id);
      const tmp = `${target}.tmp-${process.pid}`;
      fs.writeFileSync(tmp, bytes, { mode: 0o600 });
      fs.renameSync(tmp, target);
      return target;
    },
    read(id) {
      try {
        return fs.readFileSync(file(id));
      } catch {
        return null;
      }
    },
    remove(id) {
      fs.rmSync(file(id), { force: true });
    },
  };
}
