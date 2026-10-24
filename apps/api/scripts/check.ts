import { config } from "../src/config.js";
import { getMockInventory } from "../src/sigen/mock.js";
import { SigenClient } from "../src/sigen/client.js";
import { SigenSession } from "../src/sigen/session.js";
import { SigenError } from "../src/sigen/types.js";

async function main() {
  if (config.mock) {
    const inventory = getMockInventory();
    print(inventory);
    return;
  }

  const session = new SigenSession(config.sigen);
  const client = new SigenClient(session, config.sigen.baseUrl);

  try {
    const inventory = await client.getInventory();
    print(inventory);
  } finally {
    await session.close();
  }
}

function print(inventory: Awaited<ReturnType<SigenClient["getInventory"]>>) {
  console.log(`Propriedades: ${inventory.propriedades.length}`);
  console.log(`Bovinos: ${inventory.total}`);
  console.log(`Consultado em: ${inventory.buscadoEm}`);
  console.log("");

  for (const property of inventory.propriedades) {
    const ueps = property.ueps.length > 0 ? `UEP ${property.ueps.join(", ")}` : "sem UEP";
    console.log(
      `- ${property.codigo} | ${property.localidade} - ${property.municipio}/${property.uf} | ${ueps} | ${property.animais.length} animal(is)`,
    );
    for (const animal of property.animais) {
      const label = animal.apelido ? `${animal.apelido} (${animal.brinco})` : animal.brinco;
      console.log(
        `    ${label} | ${animal.brincoOficial} | ${animal.sexo} | ${animal.idade.anos}a ${animal.idade.meses}m`,
      );
    }
  }

  if (inventory.avisos.length > 0) {
    console.log("\nAvisos:");
    for (const warning of inventory.avisos) console.log(`- ${warning}`);
  }
}

main().catch((error) => {
  if (error instanceof SigenError) {
    console.error(`[${error.code}] ${error.message}`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
