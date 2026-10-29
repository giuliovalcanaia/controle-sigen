export type {
  Animal,
  GtaAnimalInput,
  GtaConferenciaResultado,
  GtaDestino,
  GtaDestinoUep,
  GtaEtapa,
  GtaInput,
  GtaJobView,
  GtaOptions,
  GtaStatus,
  Inventory,
  InventoryEtapa,
  InventoryJobStatus,
  InventoryJobView,
  PropertyInventory,
  Sexo,
  SigenStatus,
} from "@sigen/contracts";

export type ApiErrorBody = {
  code?: string;
  message?: string;
  detalhe?: { gtaId?: number };
};
