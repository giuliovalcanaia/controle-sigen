export type UepRef = {
  id: string;
  /** Nº da UEP dentro da propriedade (ex.: "1"). */
  nr: string;
  /** Código oficial formatado (ex.: "42-000165623"). */
  codigoOficial: string;
  localidade: string;
  municipio: string;
  uf: string;
  especie: string | null;
  /** Nome do produtor na UEP (exibição; não é chave). */
  produtor: string | null;
};

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readUep(node: Record<string, unknown>, id: string): UepRef {
  const propriedade = record(node.propriedade);
  const localidade = record(propriedade?.localidade);
  const municipio = record(localidade?.municipio);
  const uf = record(municipio?.uf);
  const especieAnimal = record(node.especieAnimal);
  const pessoaProdutor = record(node.pessoaProdutor);

  const codigoOficial =
    text(propriedade?.cdOficialFormatado) || text(propriedade?.cdOficial);
  const ufSigla =
    text(uf?.sgUF) || (text(uf?.nrCodigoIBGE) === "42" ? "SC" : "");

  return {
    id,
    nr: text(node.nrUnidadeExploracao),
    codigoOficial,
    localidade: text(localidade?.nmLocalidade),
    municipio: text(municipio?.nmMunicipio),
    uf: ufSigla,
    especie: text(especieAnimal?.nmEspecieAnimal) || null,
    produtor: text(pessoaProdutor?.nmPessoa) || null,
  };
}

/**
 * A resposta de `VerificarPermissaoImprimirInventarioHome` é um JSON grande
 * com nomes de campos que já mudaram no passado. Em vez de depender de um
 * caminho fixo, varremos a estrutura atrás de `idUnidadeExploracao` e lemos
 * os campos que a tela de GTA precisa: código oficial, nº da UEP, localidade,
 * município, UF, espécie e nome do produtor.
 *
 * O CPF do produtor não está nessa resposta; ele é lido do PDF do inventário
 * e fica só no servidor.
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

    const entry = node as Record<string, unknown>;
    const rawId =
      entry.idUnidadeExploracao ??
      entry.IdUnidadeExploracao ??
      entry.idUnidadeExploracaoUep;

    if (typeof rawId === "string" || typeof rawId === "number") {
      const id = String(rawId).trim();
      if (id) {
        const next = readUep(entry, id);
        const current = found.get(id);
        // Prefere a versão com mais campos preenchidos.
        const better =
          !current ||
          (!current.especie && Boolean(next.especie)) ||
          (!current.codigoOficial && Boolean(next.codigoOficial));
        if (better) {
          found.set(id, next);
        }
      }
    }

    for (const [key, child] of Object.entries(entry)) {
      if (key === "especieAnimal" || key === "pessoaProdutor") continue;
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
