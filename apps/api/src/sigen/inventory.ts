import type { Animal, Inventory, ParsedInventory, PropertyInventory } from "./types.js";

function compareAnimals(a: Animal, b: Animal): number {
  const aNome = a.apelido?.trim() ?? "";
  const bNome = b.apelido?.trim() ?? "";

  // Animais com apelido vêm primeiro, em ordem alfabética.
  if (aNome && !bNome) return -1;
  if (!aNome && bNome) return 1;
  if (aNome && bNome) {
    return aNome.localeCompare(bNome, "pt-BR", { sensitivity: "base" });
  }

  return a.brinco.localeCompare(b.brinco, "pt-BR", { numeric: true });
}

/** Junta as UEPs de uma mesma propriedade e remove duplicatas por brinco oficial. */
export function groupInventories(parsed: ParsedInventory[]): Inventory {
  const properties = new Map<string, PropertyInventory>();

  for (const item of parsed) {
    if (item.especie.toUpperCase() !== "BOVINO") continue;

    let property = properties.get(item.codigoOficial);
    if (!property) {
      property = {
        codigo: item.codigoOficial,
        localidade: item.localidade,
        municipio: item.municipio,
        uf: item.uf,
        ueps: [],
        animais: [],
      };
      properties.set(item.codigoOficial, property);
    }

    if (!property.ueps.includes(item.uep)) property.ueps.push(item.uep);

    for (const animal of item.animais) {
      if (!property.animais.some((existing) => existing.key === animal.key)) {
        property.animais.push(animal);
      }
    }
  }

  const list = [...properties.values()].sort((a, b) =>
    `${a.localidade} ${a.codigo}`.localeCompare(`${b.localidade} ${b.codigo}`, "pt-BR"),
  );

  for (const property of list) {
    property.ueps.sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    property.animais.sort(compareAnimals);
  }

  return {
    buscadoEm: new Date().toISOString(),
    total: list.reduce((sum, property) => sum + property.animais.length, 0),
    propriedades: list,
    avisos: [],
  };
}

/** Aplica os apelidos e as fotos locais sobre o inventário vindo do SIGEN. */
export function mergeExtras(
  inventory: Inventory,
  nicknames: Map<string, string>,
  photoVersions: Map<string, number> = new Map(),
): Inventory {
  const properties = inventory.propriedades.map((property) => ({
    ...property,
    animais: property.animais.map((animal) => ({
      ...animal,
      apelido: nicknames.get(animal.key) ?? null,
      fotoVersao: photoVersions.get(animal.key) ?? null,
    })),
  }));

  // Reordena agora que os apelidos estão preenchidos.
  for (const property of properties) {
    property.animais.sort(compareAnimals);
  }

  return { ...inventory, propriedades: properties };
}
