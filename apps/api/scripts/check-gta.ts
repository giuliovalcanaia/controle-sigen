import { config } from "../src/config.js";
import { PlaywrightGtaForm } from "../src/sigen/gta.js";
import { SigenSession } from "../src/sigen/session.js";

/**
 * Checagem somente leitura da tela de GTA.
 *
 * Abre a tela, confere os componentes e o listener da data de saída. Não
 * preenche nada e nunca clica em Salvar. Use depois de atualizações do SIGEN
 * ou antes de habilitar a emissão em produção.
 */
const session = new SigenSession(config.sigen);

try {
  await session.withWritePage(async (page) => {
    const form = new PlaywrightGtaForm(page, config.sigen.baseUrl);
    await form.open();

    const frame = page.frame({ url: /SaidaAnimais/ });
    if (!frame) {
      throw new Error("Não encontrei o iframe da tela de GTA.");
    }

    const info = (await frame.evaluate(`(() => {
      const E = window.Ext;
      const ids = [
        "dtSaida",
        "dtValidade",
        "cbLocalDestino",
        "cbMotivoSaida",
        "cbFinalidadeGta",
        "cbMeioTransporteGta",
        "cbNrManejo",
        "gdrBrincos",
      ];
      const components = {};
      for (const id of ids) {
        const component = E.getCmp(id);
        components[id] = Boolean(component);
      }
      const saida = E.getCmp("dtSaida");
      const listeners =
        saida && saida.events && saida.events.change
          ? saida.events.change.listeners.length
          : 0;
      const salvar = E.ComponentMgr.all.items.some(
        (component) => component.text === "F10 - Salvar",
      );
      return { components, dtSaidaChangeListeners: listeners, salvar };
    })()`)) as {
      components: Record<string, boolean>;
      dtSaidaChangeListeners: number;
      salvar: boolean;
    };

    console.log(JSON.stringify(info, null, 2));

    const missing = Object.entries(info.components)
      .filter(([, present]) => !present)
      .map(([id]) => id);

    if (missing.length > 0 || info.dtSaidaChangeListeners < 1 || !info.salvar) {
      throw new Error(
        `A tela de GTA mudou. Faltando: ${missing.join(", ") || "listener/salvar"}.`,
      );
    }

    console.log(
      "Tela de GTA OK (somente leitura; nada foi preenchido nem salvo).",
    );
  });
} finally {
  await session.close();
}
