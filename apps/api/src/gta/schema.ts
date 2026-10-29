import { z } from "zod";
import { addDaysIso } from "@sigen/contracts";
import {
  GTA_FINALIDADES,
  GTA_MAX_ANIMAIS,
  GTA_MAX_DIAS_VALIDADE,
  GTA_TRANSPORTES,
} from "./constants.js";

export {
  addDaysIso,
  formatIsoBr as formatBr,
  maskDocumento,
  sanitizeErrorMessage,
} from "@sigen/contracts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Data de hoje no fuso de Santa Catarina, no formato YYYY-MM-DD. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isValidIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const codigoOficial = z
  .string()
  .trim()
  .regex(/^\d{2}-\d{6,9}$/, "Código oficial da propriedade inválido.");

const uep = z
  .string()
  .trim()
  .regex(/^\d{1,3}$/, "Número da UEP inválido.");

const cpf = z
  .string()
  .trim()
  .regex(/^\d{11}$|^\d{14}$/, "Informe um CPF ou CNPJ válido.");

const animal = z.object({
  key: z.string().trim().regex(/^\d{15}$/, "Brinco oficial inválido."),
  brinco: z.string().trim().regex(/^\d{6}$/, "Nº de manejo inválido."),
});

const destino = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("propria"),
    codigoOficial,
    uep,
  }),
  z.object({
    tipo: z.literal("terceiro"),
    cpf,
    codigoOficial,
    uep,
  }),
]);

export const gtaInputSchema = z
  .object({
    origem: z.object({ codigoOficial, uep }),
    destino,
    animais: z
      .array(animal)
      .min(1, "Escolha pelo menos um animal.")
      .max(GTA_MAX_ANIMAIS, `Escolha no máximo ${GTA_MAX_ANIMAIS} animais.`),
    finalidade: z
      .string()
      .trim()
      .refine(
        (value) => (GTA_FINALIDADES as readonly string[]).includes(value),
        "Finalidade inválida.",
      ),
    dataSaida: z.string().trim().regex(DATE_RE, "Data de saída inválida."),
    dataValidade: z.string().trim().regex(DATE_RE, "Data de validade inválida."),
    transporte: z
      .string()
      .trim()
      .refine(
        (value) => (GTA_TRANSPORTES as readonly string[]).includes(value),
        "Meio de transporte inválido.",
      ),
    notaFiscal: z.string().trim().max(30).optional(),
    placa: z.string().trim().max(10).optional(),
    lacre: z.string().trim().max(30).optional(),
    observacao: z.string().trim().max(5000).optional(),
  })
  .superRefine((value, ctx) => {
    if (!isValidIsoDate(value.dataSaida)) {
      ctx.addIssue({
        code: "custom",
        path: ["dataSaida"],
        message: "Data de saída inválida.",
      });
    }
    if (!isValidIsoDate(value.dataValidade)) {
      ctx.addIssue({
        code: "custom",
        path: ["dataValidade"],
        message: "Data de validade inválida.",
      });
    }

    const hoje = todayIso();
    if (isValidIsoDate(value.dataSaida)) {
      if (value.dataSaida < hoje) {
        ctx.addIssue({
          code: "custom",
          path: ["dataSaida"],
          message: "A data de saída não pode estar no passado.",
        });
      }
      if (value.dataSaida > addDaysIso(hoje, GTA_MAX_DIAS_VALIDADE)) {
        ctx.addIssue({
          code: "custom",
          path: ["dataSaida"],
          message: `A data de saída deve ser no máximo ${GTA_MAX_DIAS_VALIDADE} dias à frente.`,
        });
      }
    }

    if (
      isValidIsoDate(value.dataSaida) &&
      isValidIsoDate(value.dataValidade)
    ) {
      if (value.dataValidade <= value.dataSaida) {
        ctx.addIssue({
          code: "custom",
          path: ["dataValidade"],
          message: "A validade precisa ser depois da data de saída.",
        });
      }
      if (
        value.dataValidade >
        addDaysIso(value.dataSaida, GTA_MAX_DIAS_VALIDADE)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["dataValidade"],
          message: `A validade deve ser no máximo ${GTA_MAX_DIAS_VALIDADE} dias após a saída.`,
        });
      }
    }

    if (
      value.destino.codigoOficial === value.origem.codigoOficial &&
      value.destino.uep === value.origem.uep
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["destino"],
        message: "O destino precisa ser diferente da origem.",
      });
    }

    const keys = new Set(value.animais.map((item) => item.key));
    if (keys.size !== value.animais.length) {
      ctx.addIssue({
        code: "custom",
        path: ["animais"],
        message: "Há animais repetidos na seleção.",
      });
    }
  });

export const gtaLookupSchema = z.object({ cpf });

/** Primeira mensagem de erro do Zod, em português. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
