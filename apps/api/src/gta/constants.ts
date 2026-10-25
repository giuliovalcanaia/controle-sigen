export const GTA_FINALIDADES = [
  "ENGORDA",
  "REPRODUÇÃO",
  "ESPORTE",
  "EXPOSIÇÃO",
  "QUARENTENA",
  "PESAGEM",
  "EXPORTAÇÃO",
  "SAÍDA DE FRIGORÍFICO/ABATEDOURO",
  "TRABALHO",
  "LEILÃO (REPRODUTORES)",
  "LEILÃO (GADO GERAL)",
  "AGLOMERAÇÃO COM FINALIDADE COMERCIAL",
  "AGLOMERAÇÃO SEM FINALIDADE COMERCIAL",
  "PESQUISA",
  "PRODUÇÃO DE INSUMOS BIOLÓGICOS",
  "DESTRUIÇÃO",
  "ATENDIMENTO VETERINÁRIO",
] as const;

export const GTA_TRANSPORTES = [
  "A PÉ",
  "AÉREO",
  "FERROVIÁRIO",
  "MARÍTIMO/FLUVIAL",
  "RODOVIÁRIO",
] as const;

export const GTA_FINALIDADE_PADRAO = "ENGORDA";
export const GTA_TRANSPORTE_PADRAO = "RODOVIÁRIO";

/** Dias somados à data de saída para a validade padrão. */
export const GTA_VALIDADE_DIAS = 3;
export const GTA_MAX_DIAS_VALIDADE = 30;
export const GTA_MAX_ANIMAIS = 50;

/** A tela do SIGEN só é usada para destinos dentro de SC e do tipo Propriedade. */
export const GTA_UF = "SC";
export const GTA_LOCAL_DESTINO = "Dentro do Estado";
export const GTA_TIPO_DESTINO = "Propriedade";
export const GTA_TIPO_GTA = "Normal";

/** Valores internos dos combos do SIGEN (ExtJS). */
export const GTA_LOCAL_DESTINO_FLAG = "DE";
export const GTA_MOTIVO_SAIDA_FLAG = "TR";
export const GTA_TIPO_GTA_FLAG = "NO";
