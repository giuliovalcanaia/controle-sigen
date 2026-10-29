import type {
  Animal,
  Inventory,
  PropertyInventory,
  Sexo,
  SigenStatus,
} from "@sigen/contracts";

export type { Animal, Inventory, PropertyInventory, Sexo, SigenStatus };

export type ParsedInventory = {
  codigoOficial: string;
  uep: string;
  especie: string;
  localidade: string;
  municipio: string;
  uf: string;
  animais: Animal[];
  totalDeclarado: number | null;
  /** CPF/CNPJ do proprietário titular do imóvel (uso interno, nunca vai para o app). */
  documentoTitular: string;
  /** CPF/CNPJ do produtor no quadro "Produtores" (uso interno). */
  documentoProdutor: string;
};

export type ErrorCode =
  | "SEM_CREDENCIAIS"
  | "CREDENCIAIS_INVALIDAS"
  | "SESSAO_EXPIRADA"
  | "SIGEN_FORA"
  | "SIGEN_ERRO"
  | "UEP_LIST_EMPTY"
  | "PDF_LAYOUT_MUDOU"
  | "PDF_TOOL_MISSING"
  | "DADOS_INVALIDOS"
  | "GTA_CPF_ORIGEM"
  | "GTA_UEP_INVALIDA"
  | "GTA_ANIMAL_NAO_ENCONTRADO"
  | "GTA_ANIMAIS_DIVERGENTES"
  | "GTA_TELA_MUDOU"
  | "GTA_SIGEN_RECUSOU"
  | "GTA_EM_ANDAMENTO"
  | "GTA_JA_EMITIDA"
  | "GTA_ANIMAL_JA_SAIU"
  | "GTA_INCERTA"
  | "GTA_NAO_INCERTA"
  | "GTA_NAO_ENCONTRADA"
  | "GTA_NAO_CONFIRMADA"
  | "GTA_INDISPONIVEL";

export type SigenErrorDetails = {
  /** Registro que bloqueou a emissão, para a UI abrir a conferência. */
  gtaId?: number;
};

export class SigenError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly detalhe?: SigenErrorDetails;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 502,
    detalhe?: SigenErrorDetails,
  ) {
    super(message);
    this.name = "SigenError";
    this.code = code;
    this.statusCode = statusCode;
    this.detalhe = detalhe;
  }
}

export function isSigenError(error: unknown): error is SigenError {
  return error instanceof SigenError;
}
