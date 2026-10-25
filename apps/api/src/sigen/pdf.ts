import { spawn } from "node:child_process";
import type { Animal, ParsedInventory } from "./types.js";
import { SigenError } from "./types.js";

const PDFTOTEXT_MAX_BYTES = 20 * 1024 * 1024;
const PDFTOTEXT_TIMEOUT_MS = 15_000;

/**
 * Converte o PDF em texto preservando o layout das colunas.
 *
 * O SIGEN gera os relatórios com iTextSharp; `pdftotext -layout` entrega
 * uma linha por animal, que é o formato esperado por `parseInventoryText`.
 */
export function pdfToText(pdf: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn("pdftotext", ["-layout", "-", "-"], {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      reject(
        new SigenError(
          "PDF_TOOL_MISSING",
          "pdftotext não encontrado. Instale poppler-utils no servidor.",
          500,
        ),
      );
      return;
    }

    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    let size = 0;
    let finished = false;

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(
        new SigenError(
          "PDF_LAYOUT_MUDOU",
          "Tempo esgotado ao ler o PDF do SIGEN.",
        ),
      );
    }, PDFTOTEXT_TIMEOUT_MS);
    timer.unref();

    const finish = (error: Error | null, value?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value ?? "");
    };

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        finish(
          new SigenError(
            "PDF_TOOL_MISSING",
            "pdftotext não encontrado. Instale poppler-utils no servidor.",
            500,
          ),
        );
        return;
      }
      finish(
        new SigenError("PDF_LAYOUT_MUDOU", `Falha ao executar pdftotext: ${error.message}`),
      );
    });

    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > PDFTOTEXT_MAX_BYTES) {
        child.kill("SIGKILL");
        finish(
          new SigenError("PDF_LAYOUT_MUDOU", "O PDF do SIGEN é maior que o esperado."),
        );
        return;
      }
      chunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));

    child.on("close", (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(errors).toString("utf8").trim();
        finish(
          new SigenError(
            "PDF_LAYOUT_MUDOU",
            `Não foi possível ler o PDF do SIGEN${detail ? `: ${detail}` : "."}`,
          ),
        );
        return;
      }
      finish(null, Buffer.concat(chunks).toString("utf8"));
    });

    child.stdin.on("error", () => {
      // O processo pode encerrar antes de consumir todo o stdin; o close
      // com código != 0 já reporta o erro real.
    });
    child.stdin.end(pdf);
  });
}

const ROW_RE =
  /^[ \t]*(\d{15})[ \t]+(\d{6})[ \t]+(Fêmea|Macho)[ \t]+(\d+)[ \t]+(\d+)[ \t]+(\d{2}\/\d{2}\/\d{4})[ \t]*$/gm;

function readHeader(text: string) {
  const codigoOficial = text.match(/Código Oficial:\s*([0-9]{2}-[0-9]+)/i)?.[1] ?? "";
  const uep = text.match(/Nº\s*UEP:\s*(\d+)/i)?.[1] ?? "";
  const especie = text.match(/Espécie:\s*([A-ZÀ-Ü ]+)/i)?.[1]?.trim() ?? "";

  let localidade = "";
  let municipio = "";
  let uf = "";
  const localidadeLine = text
    .split(/\r?\n/)
    .find((line) => line.includes("Localidade:"));
  if (localidadeLine) {
    const value = localidadeLine.split("Localidade:")[1]?.trim() ?? "";
    const parts = value.split(/\s+-\s+/);
    localidade = parts[0]?.trim() ?? "";
    municipio = parts[1]?.trim() ?? "";
    uf = parts[2]?.trim() ?? "";
  }

  // CPF/CNPJ fica só no servidor: é usado para localizar a UEP na tela de
  // GTA e nunca é enviado ao navegador nem gravado em log.
  const documentoTitular =
    text.match(
      /Proprietário titular do imóvel:[\s\S]{0,200}?CPF\/CNPJ:\s*([0-9]{11}|[0-9]{14})/i,
    )?.[1] ?? "";

  const produtoresIndex = text.search(/\n\s*Produtores\s*\n/i);
  const produtoresBlock =
    produtoresIndex >= 0 ? text.slice(produtoresIndex, produtoresIndex + 3000) : "";
  const documentoProdutor =
    produtoresBlock.match(
      /Nome:[\s\S]{0,200}?CPF\/CNPJ:\s*([0-9]{11}|[0-9]{14})/i,
    )?.[1] ?? "";

  return {
    codigoOficial,
    uep,
    especie,
    localidade,
    municipio,
    uf,
    documentoTitular,
    documentoProdutor: documentoProdutor || documentoTitular,
  };
}

function readDeclaredTotal(lines: string[]): number | null {
  const index = lines.findIndex((line) => /Qtde\.?\s*Animais/i.test(line));
  if (index < 0) return null;

  // O total fica na última linha do quadro "Total Geral". Ele costuma vir
  // após o cabeçalho de faixas etárias e a linha "M F M F...".
  const tail = lines.slice(index, index + 5).join(" ");
  const numbers = tail.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  const value = Number(numbers[numbers.length - 1]);
  return Number.isFinite(value) ? value : null;
}

/**
 * Interpreta o texto do relatório "INVENTÁRIO DE ANIMAIS" (UEP/BOVINO).
 *
 * O parser valida a quantidade de linhas contra "Qtde. Animais". Se o
 * layout mudar, ele falha em vez de devolver dados incompletos.
 */
export function parseInventoryText(rawText: string): ParsedInventory {
  const text = rawText.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n");
  const header = readHeader(text);

  if (!header.codigoOficial || !header.uep || !header.especie) {
    throw new SigenError(
      "PDF_LAYOUT_MUDOU",
      "Não encontrei o cabeçalho do inventário no PDF do SIGEN.",
    );
  }
  if (!header.localidade) {
    throw new SigenError(
      "PDF_LAYOUT_MUDOU",
      "Não encontrei a localidade da propriedade no PDF do SIGEN.",
    );
  }

  const animals = new Map<string, Animal>();
  for (const match of text.matchAll(ROW_RE)) {
    const [, brincoOficial, brinco, sexo, anos, meses, nascimento] = match;
    if (!brincoOficial || !brinco || !sexo || !anos || !meses || !nascimento) {
      continue;
    }
    animals.set(brincoOficial, {
      key: brincoOficial,
      brinco,
      brincoOficial,
      uep: header.uep,
      sexo: sexo as Animal["sexo"],
      idade: { anos: Number(anos), meses: Number(meses) },
      nascimento,
      apelido: null,
      fotoVersao: null,
    });
  }

  const lines = text.split("\n");
  const emptyMessage = /não\s+possui\s+saldo\s+animal/i.test(text);
  const totalDeclarado = readDeclaredTotal(lines);
  const parsedAnimals = [...animals.values()];

  if (totalDeclarado !== null && parsedAnimals.length !== totalDeclarado) {
    throw new SigenError(
      "PDF_LAYOUT_MUDOU",
      `O PDF declara ${totalDeclarado} animal(is), mas o parser encontrou ${parsedAnimals.length}.`,
    );
  }

  if (totalDeclarado === null && parsedAnimals.length > 0) {
    throw new SigenError(
      "PDF_LAYOUT_MUDOU",
      "O PDF tem animais, mas não encontrei o total para conferência.",
    );
  }

  if (totalDeclarado === null && parsedAnimals.length === 0 && !emptyMessage) {
    throw new SigenError(
      "PDF_LAYOUT_MUDOU",
      "O PDF não tem animais nem a mensagem de unidade sem saldo.",
    );
  }

  return {
    ...header,
    animais: parsedAnimals,
    totalDeclarado,
  };
}
