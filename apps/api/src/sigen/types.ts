export type Sexo = "Fêmea" | "Macho";

export type Animal = {
  /** Nº Brinco oficial (15 dígitos). Chave estável do apelido. */
  key: string;
  /** Nº Manejo (6 dígitos). É o número que o produtor chama de "brinco". */
  brinco: string;
  brincoOficial: string;
  /** Nº da UEP de onde o animal veio (ex.: "1"). */
  uep?: string;
  sexo: Sexo;
  idade: {
    anos: number;
    meses: number;
  };
  nascimento: string;
  apelido: string | null;
  /** Versão da foto guardada no servidor (epoch ms) ou null se não houver. */
  fotoVersao: number | null;
};

export type PropertyInventory = {
  codigo: string;
  localidade: string;
  municipio: string;
  uf: string;
  ueps: string[];
  animais: Animal[];
};

export type Inventory = {
  buscadoEm: string;
  total: number;
  propriedades: PropertyInventory[];
  avisos: string[];
};

export type SigenStatus = {
  state: "logged_out" | "logging_in" | "active";
  expiresInSeconds: number;
};

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
  | "GTA_INCERTA"
  | "GTA_NAO_CONFIRMADA"
  | "GTA_INDISPONIVEL";

export class SigenError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;

  constructor(code: ErrorCode, message: string, statusCode = 502) {
    super(message);
    this.name = "SigenError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isSigenError(error: unknown): error is SigenError {
  return error instanceof SigenError;
}
