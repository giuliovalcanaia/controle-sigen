import { ApiError } from "./api";
import type { Animal, Inventory } from "./types";

function compareAnimals(a: Animal, b: Animal): number {
  const aNome = a.apelido?.trim() ?? "";
  const bNome = b.apelido?.trim() ?? "";
  if (aNome && !bNome) return -1;
  if (!aNome && bNome) return 1;
  if (aNome && bNome) {
    return aNome.localeCompare(bNome, "pt-BR", { sensitivity: "base" });
  }
  return a.brinco.localeCompare(b.brinco, "pt-BR", { numeric: true });
}

export function formatAge(idade: { anos: number; meses: number }): string {
  const { anos, meses } = idade;
  if (anos === 0 && meses === 0) return "menos de 1 mês";
  if (anos === 0) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  if (meses === 0) return `${anos} ${anos === 1 ? "ano" : "anos"}`;
  return `${anos} ${anos === 1 ? "ano" : "anos"} e ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function withNickname(
  inventory: Inventory,
  animalKey: string,
  apelido: string | null,
): Inventory {
  const propriedades = inventory.propriedades.map((property) => {
    const animais = property.animais.map((animal) =>
      animal.key === animalKey ? { ...animal, apelido } : animal,
    );
    animais.sort(compareAnimals);
    return { ...property, animais };
  });

  return { ...inventory, propriedades };
}

/** Troca só a versão da foto; a ordem da lista não muda. */
export function withPhoto(
  inventory: Inventory,
  animalKey: string,
  fotoVersao: number | null,
): Inventory {
  const propriedades = inventory.propriedades.map((property) => ({
    ...property,
    animais: property.animais.map((animal) =>
      animal.key === animalKey ? { ...animal, fotoVersao } : animal,
    ),
  }));

  return { ...inventory, propriedades };
}

export function describeError(error: unknown): { code: string; text: string } {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "SEM_CREDENCIAIS":
        return {
          code: error.code,
          text: "O servidor ainda não tem o login do SIGEN configurado. Peça para configurarem o acesso.",
        };
      case "CREDENCIAIS_INVALIDAS":
        return {
          code: error.code,
          text: "Não consegui entrar no SIGEN. Confira o usuário e a senha configurados no servidor.",
        };
      case "SESSAO_EXPIRADA":
        return {
          code: error.code,
          text: "A sessão do SIGEN expirou. Toque em tentar de novo que eu entro outra vez.",
        };
      case "SIGEN_FORA":
      case "SIGEN_ERRO":
        return {
          code: error.code,
          text: "O SIGEN não respondeu como esperado. Tente de novo em alguns instantes.",
        };
      case "PDF_LAYOUT_MUDOU":
        return {
          code: error.code,
          text: "O relatório do SIGEN mudou de formato e eu não consegui ler. Avise quem cuida do sistema.",
        };
      case "UEP_LIST_EMPTY":
        return {
          code: error.code,
          text: "Não encontrei nenhuma unidade de exploração na sua conta do SIGEN.",
        };
      case "SEM_CONEXAO":
        return {
          code: error.code,
          text: "Não consegui falar com o servidor. Verifique se a VPN está ligada e se o servidor está no ar.",
        };
      case "TEMPO_ESGOTADO":
        return {
          code: error.code,
          text: "O SIGEN demorou demais para responder. Tente de novo.",
        };
      default:
        return { code: error.code, text: error.message };
    }
  }

  return {
    code: "ERRO",
    text: "Não consegui buscar os animais agora. Tente de novo.",
  };
}
