export type UepRef = {
  id: string;
  especie: string | null;
};

/**
 * A resposta de `VerificarPermissaoImprimirInventarioHome` é um JSON grande
 * com nomes de campos que já mudaram no passado. Em vez de depender de um
 * caminho fixo, varremos a estrutura atrás de `idUnidadeExploracao` e, quando
 * existe, lemos `especieAnimal.nmEspecieAnimal` para descartar outras espécies.
 *
 * Não precisamos da lista de propriedades: cada PDF traz o código oficial,
 * a localidade e a UEP no cabeçalho.
 */
export function collectUeps(value: unknown): UepRef[] {
  const found = new Map<string, UepRef>();
  const seen = new WeakSet<object>();

  const walk = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    const record = node as Record<string, unknown>;
    const rawId =
      record.idUnidadeExploracao ??
      record.IdUnidadeExploracao ??
      record.idUnidadeExploracaoUep;

    if (typeof rawId === "string" || typeof rawId === "number") {
      const id = String(rawId).trim();
      if (id) {
        const especieAnimal = record.especieAnimal;
        let especie: string | null = null;
        if (especieAnimal && typeof especieAnimal === "object") {
          const name = (especieAnimal as Record<string, unknown>).nmEspecieAnimal;
          if (typeof name === "string" && name.trim()) especie = name.trim();
        }
        const existing = found.get(id);
        if (!existing || (!existing.especie && especie)) {
          found.set(id, { id, especie });
        }
      }
    }

    for (const [key, child] of Object.entries(record)) {
      if (key === "especieAnimal") continue;
      walk(child);
    }
  };

  walk(value);
  return [...found.values()];
}

/** Compatibilidade: apenas os IDs, sem informação de espécie. */
export function collectUepIds(value: unknown): string[] {
  return collectUeps(value).map((uep) => uep.id);
}
