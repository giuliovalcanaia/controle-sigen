import { Mic, Send, Square, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  createSpeechRecognition,
  speechSupported,
  type SpeechRecognitionLike,
} from "../speech";

type Props = {
  loading: boolean;
  gtaBusy: boolean;
  gtaPrompt: string | null;
  onSend: (text: string) => void;
  onList: () => void;
  onGta: () => void;
};

export function Composer({
  loading,
  gtaBusy,
  gtaPrompt,
  onSend,
  onList,
  onGta,
}: Props) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const waitingGta = gtaBusy && !gtaPrompt;
  const inputDisabled = loading || waitingGta;

  useEffect(() => {
    setVoiceAvailable(speechSupported());
    return () => {
      recognition.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (gtaPrompt) inputRef.current?.focus();
  }, [gtaPrompt]);

  function submit() {
    const value = text.trim();
    if (!value || inputDisabled) return;
    onSend(value);
    setText("");
    recognition.current?.stop();
  }

  function toggleVoice() {
    if (!voiceAvailable) return;

    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }

    const instance = createSpeechRecognition();
    if (!instance) return;

    recognition.current = instance;
    instance.lang = "pt-BR";
    instance.interimResults = true;
    instance.continuous = false;

    instance.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0]?.transcript ?? "";
      }
      setText(transcript.trimStart());
    };
    instance.onend = () => setListening(false);
    instance.onerror = () => setListening(false);

    instance.start();
    setListening(true);
    inputRef.current?.focus();
  }

  return (
    <div className="safe-bottom border-t border-cream-200/80 bg-cream-50/95 px-4 pt-3 backdrop-blur sm:px-5">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-2.5 flex gap-2">
          <button
            type="button"
            onClick={onList}
            disabled={loading || gtaBusy}
            className="inline-flex h-11 min-w-0 flex-[1.7] items-center justify-center gap-1 rounded-full border border-forest-700/15 bg-white px-2 text-[13px] font-extrabold text-forest-800 shadow-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            <span className="truncate">Ver todos os animais</span>
          </button>

          <button
            type="button"
            onClick={onGta}
            disabled={loading || gtaBusy}
            className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-full border border-forest-700/15 bg-white px-2 text-[13px] font-extrabold text-forest-800 shadow-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            <Truck className="h-4 w-4 shrink-0" />
            <span className="truncate">Fazer GTA</span>
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 rounded-3xl border border-cream-200 bg-white p-1.5 shadow-[0_10px_30px_-18px_rgba(74,59,42,0.5)]"
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              gtaPrompt ??
              (waitingGta
                ? "Responda na GTA"
                : listening
                  ? "Ouvindo..."
                  : "Escreva ou fale...")
            }
            aria-label={gtaPrompt ?? "Mensagem"}
            enterKeyHint={gtaPrompt ? "search" : "send"}
            autoComplete="off"
            inputMode={gtaPrompt ? "numeric" : "text"}
            maxLength={gtaPrompt ? 18 : undefined}
            disabled={inputDisabled}
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base text-bark-700 outline-none placeholder:text-bark-500/70 disabled:opacity-60"
          />

          {voiceAvailable && !gtaPrompt && (
            <button
              type="button"
              onClick={toggleVoice}
              disabled={inputDisabled}
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-50 ${
                listening
                  ? "bg-amber-500 text-white"
                  : "text-forest-700 hover:bg-forest-700/10"
              }`}
              aria-label={listening ? "Parar de ouvir" : "Falar"}
              title={listening ? "Parar de ouvir" : "Falar"}
            >
              {listening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
            </button>
          )}

          <button
            type="submit"
            disabled={inputDisabled || text.trim().length === 0}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-700 text-white transition active:scale-95 disabled:bg-cream-200 disabled:text-bark-500/60"
            aria-label="Enviar"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>

        <p className="py-2 text-center text-[11px] leading-tight text-bark-500/80">
          Consulta não oficial · os dados vêm do SIGEN+
        </p>
      </div>
    </div>
  );
}
