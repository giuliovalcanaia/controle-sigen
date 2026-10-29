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

export type InventoryJobStatus = "buscando" | "pronto" | "erro";
export type InventoryEtapa =
  | "conectando"
  | "propriedades"
  | "animais"
  | "concluido";

export type InventoryJobView = {
  id: number;
  status: InventoryJobStatus;
  etapa: InventoryEtapa;
  atual: number;
  total: number;
  inventario: Inventory | null;
  erro: string | null;
  codigo: string | null;
};
