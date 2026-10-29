export type GtaStatus =
  | "preparando"
  | "preenchendo"
  | "salvando"
  | "conferida"
  | "emitida"
  | "nao_emitida"
  | "incerta"
  | "erro";

export type GtaEtapa =
  | "conferindo"
  | "abrindo"
  | "origem"
  | "destino"
  | "finalidade"
  | "animais"
  | "dados"
  | "salvando"
  | "pdf"
  | "concluido";

export type GtaDestino =
  | {
      tipo: "propria";
      codigoOficial: string;
      uep: string;
    }
  | {
      tipo: "terceiro";
      /** CPF/CNPJ do produtor de destino. Não é gravado nem logado. */
      cpf: string;
      codigoOficial: string;
      uep: string;
    };

export type GtaAnimalInput = {
  /** Nº Brinco oficial (15 dígitos). */
  key: string;
  /** Nº Manejo (6 dígitos), o número que o produtor vê. */
  brinco: string;
};

export type GtaInput = {
  origem: {
    codigoOficial: string;
    uep: string;
  };
  destino: GtaDestino;
  animais: GtaAnimalInput[];
  finalidade: string;
  /** Datas no formato YYYY-MM-DD. */
  dataSaida: string;
  dataValidade: string;
  transporte: string;
  notaFiscal?: string;
  placa?: string;
  lacre?: string;
  observacao?: string;
};

export type GtaDestinoUep = {
  /** ID interno da UEP no SIGEN. */
  id: string;
  codigoOficial: string;
  uep: string;
  localidade: string;
  municipio: string;
  uf: string;
  especie: string;
  produtor: string | null;
};

export type GtaOptions = {
  finalidades: string[];
  transportes: string[];
  hoje: string;
  validadePadrao: string;
  maxAnimais: number;
  uf: string;
  /** Quando falso, o app só confere o preenchimento e nunca salva. */
  emissaoAtiva: boolean;
};

export type GtaJobView = {
  id: number;
  status: GtaStatus;
  etapa: GtaEtapa;
  atual: number;
  total: number;
  numero: string | null;
  temPdf: boolean;
  erro: string | null;
  /** Código do erro do job (ex.: GTA_UEP_INVALIDA). */
  codigo: string | null;
  criadaEm: string;
  atualizadaEm: string;
};

/** Resposta do produtor depois de conferir uma GTA incerta no SIGEN. */
export type GtaConferenciaResultado = "emitida" | "nao_emitida";

export const GTA_FINALIDADE_PADRAO = "ENGORDA";
export const GTA_TRANSPORTE_PADRAO = "RODOVIÁRIO";

/** Dias somados à data de saída para a validade padrão. */
export const GTA_VALIDADE_DIAS = 3;
export const GTA_MAX_DIAS_VALIDADE = 30;
