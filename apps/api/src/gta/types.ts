import type {
  GtaAnimalInput,
  GtaConferenciaResultado,
  GtaDestino,
  GtaDestinoUep,
  GtaEtapa,
  GtaInput,
  GtaJobView,
  GtaOptions,
  GtaStatus,
} from "@sigen/contracts";

export type {
  GtaAnimalInput,
  GtaConferenciaResultado,
  GtaDestino,
  GtaDestinoUep,
  GtaEtapa,
  GtaInput,
  GtaJobView,
  GtaOptions,
  GtaStatus,
};

/** Status que impedem uma nova emissão da mesma viagem. */
export const GTA_STATUS_BLOQUEANTES = [
  "preparando",
  "preenchendo",
  "salvando",
  "incerta",
  "emitida",
] as const satisfies readonly GtaStatus[];

export type GtaProgresso = {
  etapa: GtaEtapa;
  atual: number;
  total: number;
};

/** O que o driver precisa saber para preencher a tela do SIGEN. */
export type GtaFormInput = GtaInput & {
  /** CPF/CNPJ do produtor de origem, lido do PDF (nunca sai do servidor). */
  documentoOrigem: string;
  /** CPF/CNPJ do produtor de destino (próprio ou terceiro). */
  documentoDestino: string;
  /** Nº da UEP interna do SIGEN, resolvido a partir de código + nº. */
  origemUepId: string;
  destinoUepId: string;
};

export type GtaFormResult = {
  numero: string | null;
  /** PDF da GTA, quando o SIGEN oferece o download. */
  pdf: Buffer | null;
};

export type GtaStartRequest = {
  input: GtaInput;
  modo: "conferir" | "emitir";
};

export type GtaPermissao = {
  exigeAnexo: boolean;
  exigeSenha: boolean;
  exigeDescricao: boolean;
  exigeJustificativaBloqueio: boolean;
};

/** Objeto que o SIGEN devolve em `SaidaAnimais/Get/<id>`. */
export type SigenGtaRecord = {
  saidaAnimais: {
    localDestino: { csFlag: string };
    motivoSaida: { csFlag: string };
    tipoGta: { csFlag: string };
    finalidadeGta: { idFinalidadeGta: number | string };
    meioTransporteGta: { idMeioTransporteGta: number | string };
    dtSaida: string | Date;
    dtValidade: string | Date;
    unidadeExploracaoOrigem: SigenUepValue | null;
    unidadeExploracaoDestino: SigenUepValue | null;
    pessoaEmitente: { idPessoa: number | string } | null;
    listaSaidaAnimaisBrinco: SigenAnimal[];
    municipioGta: { idMunicipio: number | string } | null;
    gta:
      | {
          idGta?: number;
          dsSerieGta?: string;
          nrSequenciaGta?: string;
        }
      | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type SigenUepValue = {
  idUnidadeExploracao: number | string;
  cdOficialFormatado?: string;
  nrUnidadeExploracao?: string;
  [key: string]: unknown;
};

export type SigenAnimal = {
  nrBrincoNovo?: string;
  nrBrinco?: number | string;
  nrManejo?: number | string;
  [key: string]: unknown;
};

export type GtaSaveResult = {
  id: number;
  data: unknown;
  message: string;
};
