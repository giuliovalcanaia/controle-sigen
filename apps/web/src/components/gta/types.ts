import type { GtaOriginUnit } from "../../gta";
import type { GtaActions, GtaFlowState } from "../../gtaFlow";
import type { Animal } from "../../types";

export type GtaStepProps = {
  state: GtaFlowState;
  units: GtaOriginUnit[];
  origin: GtaOriginUnit | null;
  originKey: string | null;
  selectedAnimals: Animal[];
  actions: GtaActions;
  active: boolean;
};
