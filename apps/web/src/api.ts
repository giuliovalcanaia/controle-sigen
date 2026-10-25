import type {
  ApiErrorBody,
  GtaDestinoUep,
  GtaInput,
  GtaJobView,
  GtaOptions,
  Inventory,
  SigenStatus,
} from "./types";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
      throw new ApiError(
        body.code ?? "ERRO",
        body.message ?? "Não foi possível concluir a operação.",
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("TEMPO_ESGOTADO", "O SIGEN demorou demais para responder.", 504);
    }
    throw new ApiError(
      "SEM_CONEXAO",
      "Não consegui falar com o servidor. Verifique a VPN ou se o servidor está ligado.",
      0,
    );
  } finally {
    window.clearTimeout(timer);
  }
}

export const api = {
  getInventory: () => request<Inventory>("/api/animals"),
  getStatus: () => request<{ sigen: SigenStatus }>("/api/status"),
  setNickname: (animalKey: string, apelido: string) =>
    request<{ ok: true; apelido: string | null }>(
      `/api/nicknames/${encodeURIComponent(animalKey)}`,
      { method: "PUT", body: JSON.stringify({ apelido }) },
    ),
  setPhoto: (animalKey: string, foto: Blob) =>
    request<{ ok: true; fotoVersao: number }>(
      `/api/photos/${encodeURIComponent(animalKey)}`,
      {
        method: "PUT",
        body: foto,
        headers: { "Content-Type": "image/jpeg" },
      },
    ),
  removePhoto: (animalKey: string) =>
    request<{ ok: true }>(`/api/photos/${encodeURIComponent(animalKey)}`, {
      method: "DELETE",
    }),
  getGtaOptions: () => request<GtaOptions>("/api/gta/opcoes"),
  lookupGtaDestinos: (cpf: string, dataSaida: string) =>
    request<{ ueps: GtaDestinoUep[] }>("/api/gta/destinos", {
      method: "POST",
      body: JSON.stringify({ cpf, dataSaida }),
    }),
  startGta: (body: {
    gta: GtaInput;
    modo: "conferir" | "emitir";
    forcar?: boolean;
  }) =>
    request<{ id: number; status: string }>("/api/gta", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getGta: (id: number) => request<GtaJobView>(`/api/gta/${id}`),
  listGtas: () => request<{ gtas: GtaJobView[] }>("/api/gta"),
  gtaPdfUrl: (id: number) => `/api/gta/${id}/pdf`,
  logout: () => request<{ ok: true }>("/api/session/logout", { method: "POST" }),
};
