import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isPdf, openGtaPdfStore } from "./pdf.js";

let dir = "";

afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = "";
});

describe("GtaPdfStore", () => {
  it("grava o PDF com permissão 600, lê e remove", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sigen-gta-"));
    const store = openGtaPdfStore(dir);
    const pdf = Buffer.from("%PDF-1.4\nconteudo");

    const file = store.save(7, pdf);
    expect(file).toBe(path.join(dir, "7.pdf"));
    expect(store.read(7)).toEqual(pdf);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);

    store.remove(7);
    expect(store.read(7)).toBeNull();
  });

  it("recusa conteúdo que não é PDF", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sigen-gta-"));
    const store = openGtaPdfStore(dir);

    expect(isPdf(Buffer.from("%PDF-1.7"))).toBe(true);
    expect(isPdf(Buffer.from("<html>"))).toBe(false);
    expect(() => store.save(1, Buffer.from("<html>"))).toThrow();
  });
});
