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

export type GtaStatus =
  | "preparando"
  | "preenchendo"
  | "salvando"
  | "conferida"
  | "emitida"
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

export type GtaProgresso = {
  etapa: GtaEtapa;
  atual: number;
  total: number;
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
  criadaEm: string;
  atualizadaEm: string;
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

export type GtaStartRequest = {
  input: GtaInput;
  modo: "conferir" | "emitir";
  /** Só para reemitir uma GTA idêntica já emitida, após confirmação. */
  forcar?: boolean;
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
