export type Sexo = "Fêmea" | "Macho";

export type Animal = {
  key: string;
  brinco: string;
  brincoOficial: string;
  sexo: Sexo;
  idade: { anos: number; meses: number };
  nascimento: string;
  apelido: string | null;
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
