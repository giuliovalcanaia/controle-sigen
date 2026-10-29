import {
  sanitizeErrorMessage,
  type Inventory,
  type InventoryJobView,
} from "@sigen/contracts";
import { SigenError } from "./sigen/types.js";

export type {
  InventoryEtapa,
  InventoryJobStatus,
  InventoryJobView,
} from "@sigen/contracts";

export type InventoryLoad = (
  onProgress?: (atual: number, total: number) => void,
) => Promise<Inventory>;

export type InventoryService = {
  /** Começa (ou reaproveita) uma consulta. */
  start(): { id: number };
  get(id: number): InventoryJobView | null;
};

type Job = InventoryJobView;

/**
 * Job do inventário.
 *
 * O POST devolve o id na hora e o app acompanha por `GET`. Uma consulta em
 * andamento é reaproveitada por quem chegar depois — o retry do produtor não
 * entra na fila atrás do mesmo trabalho. O resultado é descartável: cada
 * consulta nova baixa PDFs novos (o SIGEN é a fonte da verdade).
 */
export function createInventoryService(deps: {
  load: InventoryLoad;
}): InventoryService {
  const { load } = deps;
  const jobs = new Map<number, Job>();
  let sequence = 0;
  let atual: Job | null = null;

  function prune(): void {
    while (jobs.size > 20) {
      const oldest = jobs.keys().next().value;
      if (oldest === undefined) return;
      jobs.delete(oldest);
    }
  }

  return {
    start() {
      if (atual?.status === "buscando") return { id: atual.id };

      const job: Job = {
        id: ++sequence,
        status: "buscando",
        etapa: "conectando",
        atual: 0,
        total: 0,
        inventario: null,
        erro: null,
        codigo: null,
      };

      jobs.set(job.id, job);
      atual = job;
      prune();

      void (async () => {
        try {
          const inventario = await load((atualBaixado, total) => {
            job.etapa = total > 0 ? "animais" : "conectando";
            job.atual = atualBaixado;
            job.total = total;
          });

          job.inventario = inventario;
          job.status = "pronto";
          job.etapa = "concluido";
          if (job.total === 0) {
            job.total = inventario.propriedades.length;
          }
          job.atual = job.total;
        } catch (error) {
          job.status = "erro";
          job.etapa = "concluido";
          job.erro =
            error instanceof Error
              ? sanitizeErrorMessage(error.message)
              : "Não consegui buscar os animais.";
          job.codigo =
            error instanceof SigenError ? error.code : "SIGEN_ERRO";
        }
      })();

      return { id: job.id };
    },

    get(id) {
      const job = jobs.get(id);
      return job ? { ...job } : null;
    },
  };
}
