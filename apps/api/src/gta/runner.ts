import type { GtaForm, GtaProgress } from "../sigen/gta.js";
import { SigenError } from "../sigen/types.js";
import type {
  GtaFormInput,
  GtaPermissao,
  SigenGtaRecord,
} from "./types.js";

export type GtaRunResult = {
  status: "conferida" | "emitida";
  numero: string | null;
  pdf: Buffer | null;
};

function permissionMessage(permission: GtaPermissao): string {
  const requirements: string[] = [];
  if (permission.exigeSenha) requirements.push("senha");
  if (permission.exigeAnexo) requirements.push("anexo");
  if (permission.exigeDescricao) requirements.push("descrição");
  if (permission.exigeJustificativaBloqueio) {
    requirements.push("justificativa de bloqueio");
  }

  return `O SIGEN pede ${requirements.join(", ")} para esta GTA. Nada foi emitido; finalize manualmente no SIGEN.`;
}

function gtaNumber(record: SigenGtaRecord): string | null {
  const gta = record.saidaAnimais?.gta;
  if (!gta) return null;
  const serie = String(gta.dsSerieGta ?? "").trim();
  const sequencia = String(gta.nrSequenciaGta ?? "").trim();
  const numero = [serie, sequencia].filter(Boolean).join(" ").trim();
  return numero || null;
}

/**
 * Preenche, confere e (quando `modo = "emitir"`) salva uma GTA.
 *
 * O `onBeforeSave` é chamado imediatamente antes do POST de criação, para o
 * chamador gravar o estado `salvando` no banco. Se algo falhar depois disso,
 * o chamador deve tratar como `incerta` e não repetir sozinho.
 */
export async function runGtaJob(
  form: GtaForm,
  input: GtaFormInput,
  modo: "conferir" | "emitir",
  onProgress?: GtaProgress,
  onBeforeSave?: () => void,
): Promise<GtaRunResult> {
  await form.open();
  await form.fill(input, onProgress);

  const record = await form.readRecord();
  form.verify(record, input);

  const permission = await form.preflight(record);
  if (modo === "conferir") {
    return { status: "conferida", numero: null, pdf: null };
  }

  if (
    permission.exigeSenha ||
    permission.exigeAnexo ||
    permission.exigeDescricao ||
    permission.exigeJustificativaBloqueio
  ) {
    throw new SigenError("GTA_INDISPONIVEL", permissionMessage(permission));
  }

  onBeforeSave?.();
  const saved = await form.add(record);

  let numero: string | null = null;
  try {
    const full = await form.get(saved.id);
    numero = gtaNumber(full);
  } catch {
    // A GTA foi criada; só não conseguimos reler o número. O app avisa para
    // conferir no SIGEN, mas não marca como erro.
    numero = null;
  }

  let pdf: Buffer | null = null;
  try {
    pdf = await form.print(saved.id);
  } catch {
    pdf = null;
  }

  return { status: "emitida", numero, pdf };
}
