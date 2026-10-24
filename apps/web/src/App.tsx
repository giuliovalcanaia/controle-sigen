import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";
import { Composer } from "./components/Composer";
import { CowMark } from "./components/CowMark";
import { InventoryCard } from "./components/InventoryCard";
import { NicknameDialog } from "./components/NicknameDialog";
import type { Animal, Inventory, SigenStatus } from "./types";
import { describeError, withNickname } from "./utils";

type Message =
  | { id: number; role: "user"; kind: "text"; text: string }
  | { id: number; role: "assistant"; kind: "text"; text: string }
  | { id: number; role: "assistant"; kind: "inventory"; inventory: Inventory }
  | { id: number; role: "assistant"; kind: "error"; code: string; text: string };

const LIST_RE = /animais|rebanho|listar|lista|mostrar|ver|meus|quantos|cabe[cç]as|bois|vacas|gado/i;

let nextId = 1;
const uid = () => nextId++;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Buscando os animais no SIGEN...");
  const [status, setStatus] = useState<SigenStatus | null>(null);
  const [editing, setEditing] = useState<Animal | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastRequest = useRef("Ver todos os animais");
  const busy = useRef(false);
  const scrollToResult = useRef(false);

  useEffect(() => {
    api
      .getStatus()
      .then((response) => setStatus(response.sigen))
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    const last = messages[messages.length - 1];

    // A lista é alta: rolar até o fim esconderia o resumo e a primeira
    // propriedade. Quando um resultado novo chega, alinhamos o topo do
    // cartão. Editar um apelido não deve mover a tela.
    if (last?.kind === "inventory") {
      if (scrollToResult.current) {
        scrollToResult.current = false;
        document
          .querySelector("[data-inventory-message]")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const runList = useCallback(
    async (text = "Ver todos os animais", options?: { refresh?: boolean }) => {
      // Evita dois logins/consultas se o botão for tocado duas vezes antes
      // do React renderizar o estado de carregamento.
      if (busy.current) return;
      busy.current = true;
      lastRequest.current = text;

      if (!options?.refresh) {
        setMessages((previous) => [
          ...previous,
          { id: uid(), role: "user", kind: "text", text },
        ]);
      } else {
        setMessages((previous) => previous.filter((message) => message.kind !== "inventory"));
      }

      setLoadingText(
        status?.state === "active" ? "Buscando os animais no SIGEN..." : "Entrando no SIGEN...",
      );
      scrollToResult.current = true;
      setLoading(true);

      try {
        const inventory = await api.getInventory();
        setStatus((current) =>
          current ? { ...current, state: "active" } : { state: "active", expiresInSeconds: 0 },
        );
        setMessages((previous) => [
          ...previous.filter((message) => message.kind !== "inventory"),
          { id: uid(), role: "assistant", kind: "inventory", inventory },
        ]);
      } catch (error) {
        const { code, text: message } = describeError(error);
        setMessages((previous) => [
          ...previous,
          { id: uid(), role: "assistant", kind: "error", code, text: message },
        ]);
        if (code === "SESSAO_EXPIRADA" || code === "CREDENCIAIS_INVALIDAS") {
          setStatus({ state: "logged_out", expiresInSeconds: 0 });
        }
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [status?.state],
  );

  function handleSend(text: string) {
    if (LIST_RE.test(text)) {
      void runList(text);
      return;
    }

    setMessages((previous) => [
      ...previous,
      { id: uid(), role: "user", kind: "text", text },
      {
        id: uid(),
        role: "assistant",
        kind: "text",
        text: "Por enquanto eu só sei mostrar os animais. Toque em “Ver todos os animais” que eu busco no SIGEN.",
      },
    ]);
  }

  async function saveNickname(apelido: string | null) {
    if (!editing) return;

    try {
      await api.setNickname(editing.key, apelido ?? "");
    } catch (error) {
      if (error instanceof ApiError) throw new Error(error.message);
      throw new Error("Não consegui salvar o apelido. Tente de novo.");
    }

    setMessages((previous) =>
      previous.map((message) =>
        message.kind === "inventory"
          ? {
              ...message,
              inventory: withNickname(message.inventory, editing.key, apelido || null),
            }
          : message,
      ),
    );
    setEditing(null);
  }

  async function logout() {
    if (logoutBusy) return;
    if (!window.confirm("Encerrar a sessão do SIGEN agora?")) return;

    setLogoutBusy(true);
    try {
      await api.logout();
      setStatus({ state: "logged_out", expiresInSeconds: 0 });
      setMessages([]);
    } catch {
      // A sessão local pode já ter expirado; o efeito prático é o mesmo.
      setStatus({ state: "logged_out", expiresInSeconds: 0 });
      setMessages([]);
    } finally {
      setLogoutBusy(false);
    }
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden">
      <header className="safe-top bg-forest-800 text-cream-50 shadow-sm">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pb-3 sm:px-5">
          <CowMark className="h-11 w-11 shrink-0 rounded-2xl shadow-md" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black leading-tight tracking-tight">
              SIGEN Campo
            </h1>
            <p className="truncate text-xs text-cream-200/80">
              Seu rebanho bovino, de um jeito simples
            </p>
          </div>

          <StatusPill status={status} />

          <button
            type="button"
            onClick={() => void logout()}
            disabled={logoutBusy}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-cream-100/80 transition hover:bg-white/10 disabled:opacity-50"
            aria-label="Sair do SIGEN"
            title="Sair do SIGEN"
          >
            {logoutBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-3 sm:px-5">
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4"
          role="log"
          aria-live="polite"
          aria-label="Conversa"
        >
          {messages.length === 0 && !loading && <Welcome onList={() => void runList()} />}

          <div className="space-y-3">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onEdit={setEditing}
                onRefresh={() => void runList(lastRequest.current, { refresh: true })}
                onRetry={() => void runList(lastRequest.current, { refresh: true })}
                refreshing={loading}
              />
            ))}

            {loading && <LoadingBubble text={loadingText} />}
            <div ref={endRef} />
          </div>
        </div>

        <Composer
          loading={loading}
          onSend={handleSend}
          onList={() => void runList()}
        />
      </main>

      <NicknameDialog
        animal={editing}
        onClose={() => setEditing(null)}
        onSave={saveNickname}
      />
    </div>
  );
}

function Welcome({ onList }: { onList: () => void }) {
  return (
    <div className="flex gap-2.5">
      <AssistantAvatar />
      <div className="message-enter w-full max-w-[34rem]">
        <div className="rounded-3xl rounded-tl-md border border-cream-200 bg-cream-50 px-5 py-4 shadow-sm">
          <p className="text-base leading-relaxed text-bark-700">
            Olá! Eu busco no SIGEN os animais das suas propriedades e mostro o brinco
            e o apelido de cada um.
          </p>
          <button
            type="button"
            onClick={onList}
            className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-forest-700 px-5 text-base font-extrabold text-white shadow-md transition active:scale-[0.99]"
          >
            Ver todos os animais
            <ArrowRight className="h-5 w-5" />
          </button>
          <p className="mt-3 text-center text-xs text-bark-500">
            Na primeira consulta, o SIGEN pode levar alguns segundos para entrar.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  onEdit,
  onRefresh,
  onRetry,
  refreshing,
}: {
  message: Message;
  onEdit: (animal: Animal) => void;
  onRefresh: () => void;
  onRetry: () => void;
  refreshing: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="message-enter flex justify-end">
        <p className="max-w-[85%] rounded-3xl rounded-br-md bg-forest-700 px-4 py-2.5 text-[15px] font-semibold text-white shadow-sm">
          {message.text}
        </p>
      </div>
    );
  }

  if (message.kind === "inventory") {
    return (
      <div className="message-enter scroll-mt-6" data-inventory-message>
        <InventoryCard
          inventory={message.inventory}
          onEdit={onEdit}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      </div>
    );
  }

  if (message.kind === "error") {
    return (
      <div className="message-enter flex gap-2.5">
        <AssistantAvatar />
        <div className="max-w-[34rem] rounded-3xl rounded-tl-md border border-red-200 bg-red-50 px-4 py-3 text-red-900 shadow-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold leading-relaxed">{message.text}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-red-800 shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar de novo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-enter flex gap-2.5">
      <AssistantAvatar />
      <p className="max-w-[34rem] rounded-3xl rounded-tl-md border border-cream-200 bg-cream-50 px-4 py-3 text-[15px] leading-relaxed text-bark-700 shadow-sm">
        {message.text}
      </p>
    </div>
  );
}

function LoadingBubble({ text }: { text: string }) {
  return (
    <div className="message-enter flex gap-2.5" aria-live="polite">
      <AssistantAvatar />
      <div className="rounded-3xl rounded-tl-md border border-cream-200 bg-cream-50 px-4 py-3 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-semibold text-bark-700">
          <Loader2 className="h-4 w-4 animate-spin text-forest-700" />
          {text}
        </p>
        <p className="mt-1 pl-6 text-xs text-bark-500">
          Estou consultando o SIGEN. Isso pode levar alguns segundos.
        </p>
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div
      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-700 text-white shadow-sm"
      aria-hidden="true"
    >
      <ShieldCheck className="h-5 w-5" />
    </div>
  );
}

function StatusPill({ status }: { status: SigenStatus | null }) {
  if (status === null) {
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-cream-100/80 sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-cream-200 pulse-soft" />
        Verificando
      </span>
    );
  }

  const active = status.state === "active";
  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex ${
        active ? "bg-white/10 text-cream-100" : "bg-amber-400/15 text-amber-100"
      }`}
    >
      {active ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      {active ? "SIGEN conectado" : "SIGEN desconectado"}
    </span>
  );
}
