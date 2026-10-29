export function addDaysIso(value: string, days: number): string {
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export function formatIsoBr(value: string): string {
  const [year = "", month = "", day = ""] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function maskDocumento(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `***.***.***-${digits.slice(-2)}`;
  if (digits.length === 14) return `**.***.***/****-${digits.slice(-2)}`;
  return "***";
}

const DOCUMENTO_FORMATADO =
  /\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;

/** Evita que CPF/CNPJ apareçam em mensagens de erro e logs. */
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(DOCUMENTO_FORMATADO, (value) => maskDocumento(value))
    .replace(/\b\d{11}\b/g, (value) => maskDocumento(value))
    .replace(/\b\d{14}\b/g, (value) => maskDocumento(value));
}
