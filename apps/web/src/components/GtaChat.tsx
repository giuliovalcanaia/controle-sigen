import { Truck } from "lucide-react";
import { useEffect, useRef } from "react";
import { tituloDoCartao } from "../gtaFlow";
import type { Inventory } from "../types";
import { useGtaFlow } from "../useGtaFlow";
import { AnimalsStep } from "./gta/AnimalsStep";
import { CancelStep } from "./gta/CancelStep";
import { CpfStep } from "./gta/CpfStep";
import { DatesStep } from "./gta/DatesStep";
import { ExtrasStep } from "./gta/ExtrasStep";
import { NotePlateStep } from "./gta/NotePlateStep";
import { ResultStep } from "./gta/ResultStep";
import { ReviewStep } from "./gta/ReviewStep";
import { StatusStep } from "./gta/StatusStep";
import { UepStep } from "./gta/UepStep";
import type { GtaStepProps } from "./gta/types";
import { AssistantBubble, AssistantShell, UserBubble } from "./ChatBubble";

type Props = {
  /** Id da mensagem no chat: é o dono do "ocupado" e do campo de texto. */
  flowId: number;
  inventory: Inventory;
  /** Só a conversa mais recente pode interagir e iniciar outra emissão. */
  active: boolean;
  onBusyChange: (flowId: number, busy: boolean) => void;
  onTextRequest: (
    flowId: number,
    handler: ((text: string) => void) | null,
    prompt?: string,
  ) => void;
  onRestart: () => void;
};

export function GtaChat({
  flowId,
  inventory,
  active,
  onBusyChange,
  onTextRequest,
  onRestart,
}: Props) {
  const { state, units, origin, originKey, selectedAnimals, actions } =
    useGtaFlow({
      inventory,
      flowId,
      active,
      onBusyChange,
      onTextRequest,
      onRestart,
    });

  const bottomRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.phase === "animais") {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.history.length, state.phase]);

  const view: GtaStepProps = {
    state,
    units,
    origin,
    originKey,
    selectedAnimals,
    actions,
    active,
  };

  return (
    <div ref={cardRef} className="scroll-mt-20 space-y-3" data-gta-message>
      {state.history.map((entry) =>
        entry.role === "user" ? (
          <UserBubble key={entry.id}>{entry.text}</UserBubble>
        ) : (
          <AssistantBubble key={entry.id}>{entry.text}</AssistantBubble>
        ),
      )}

      <AssistantShell wide>
        <div className="overflow-hidden rounded-3xl border border-cream-200 bg-cream-50 shadow-sm">
          <div className="flex items-center gap-2 border-b border-cream-200 bg-white/70 px-4 py-3">
            <Truck className="h-4 w-4 shrink-0 text-forest-700" />
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-700">
              GTA · {tituloDoCartao(state.phase)}
            </p>
          </div>

          <div className="p-4">
            {state.phase === "animais" && <AnimalsStep {...view} />}
            {state.phase === "cpf" && <CpfStep {...view} />}
            {state.phase === "uep" && <UepStep {...view} />}
            {state.phase === "datas" && <DatesStep {...view} />}
            {state.phase === "extras" && <ExtrasStep {...view} />}
            {state.phase === "notaFiscal" && (
              <NotePlateStep {...view} mode="nota" />
            )}
            {state.phase === "placa" && (
              <NotePlateStep {...view} mode="placa" />
            )}
            {state.phase === "revisao" && <ReviewStep {...view} />}
            {state.phase === "status" && <StatusStep {...view} />}
            {state.phase === "resultado" && <ResultStep {...view} />}
            {state.phase === "cancelado" && <CancelStep {...view} />}
          </div>
        </div>
      </AssistantShell>

      <div ref={bottomRef} />
    </div>
  );
}
