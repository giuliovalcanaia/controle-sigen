export type Sexo = "Fêmea" | "Macho";

export type Animal = {
  key: string;
  brinco: string;
  brincoOficial: string;
  /** Nº da UEP de onde o animal veio (ex.: "1"). */
  uep?: string;
  sexo: Sexo;
  idade: { anos: number; meses: number };
  nascimento: string;
  apelido: string | null;
  /** Versão da foto guardada no servidor; null quando não há foto. */
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

export type ApiErrorBody = {
  code?: string;
  message?: string;
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

export type GtaDestino =
  | {
      tipo: "propria";
      codigoOficial: string;
      uep: string;
    }
  | {
      tipo: "terceiro";
      cpf: string;
      codigoOficial: string;
      uep: string;
    };

export type GtaAnimalInput = {
  key: string;
  brinco: string;
};

export type GtaInput = {
  origem: { codigoOficial: string; uep: string };
  destino: GtaDestino;
  animais: GtaAnimalInput[];
  finalidade: string;
  dataSaida: string;
  dataValidade: string;
  transporte: string;
  notaFiscal?: string;
  placa?: string;
  lacre?: string;
  observacao?: string;
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
  emissaoAtiva: boolean;
};
