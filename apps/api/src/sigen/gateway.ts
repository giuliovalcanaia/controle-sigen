import type { GtaDestinoUep } from "../gta/types.js";
import type { SigenClient } from "./client.js";
import { PlaywrightGtaForm, type GtaForm } from "./gta.js";
import type { SigenSession } from "./session.js";
import type { UepRef } from "./uep.js";

/**
 * Porta de entrada do SIGEN usada pela emissão.
 *
 * O serviço fala só com esta interface; o adapter Playwright encapsula a
 * sessão, a página e o formulário. Nos testes, um fake entrega um `GtaForm`
 * sem abrir navegador.
 */
export type SigenGateway = {
  listUeps(): Promise<UepRef[]>;
  quickSearchUeps(cpf: string, dataSaida: string): Promise<GtaDestinoUep[]>;
  runGtaForm<T>(fn: (form: GtaForm) => Promise<T>): Promise<T>;
};

export function createSigenGateway(deps: {
  client: SigenClient;
  session: SigenSession;
  baseUrl: string;
}): SigenGateway {
  const { client, session, baseUrl } = deps;

  return {
    listUeps: () => client.getUeps(),
    quickSearchUeps: (cpf, dataSaida) =>
      client.quickSearchUeps(cpf, dataSaida),
    runGtaForm: (fn) =>
      session.withWritePage((page) =>
        fn(new PlaywrightGtaForm(page, baseUrl)),
      ),
  };
}
