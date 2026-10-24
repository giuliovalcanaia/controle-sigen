export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechResultEvent = {
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & {
      isFinal: boolean;
    }
  >;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function speechSupported(): boolean {
  const win = window as SpeechWindow;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function createSpeechRecognition(): SpeechRecognitionLike | null {
  const win = window as SpeechWindow;
  const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}
