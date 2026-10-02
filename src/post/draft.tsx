import { createContext, useContext, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from "react";

import type { BountyToken } from "@/auth/api";
import { DEFAULT_RADIUS_M } from "@/post/options";

export type BountyPlace = { latitude: number; longitude: number; label: string };

export type BountyDraft = {
  title: string;
  instructions: string;
  place: BountyPlace | null;
  radiusM: number;
  token: BountyToken | null;
  amount: string;
  durationHours: number;
};

const initialDraft: BountyDraft = {
  title: "",
  instructions: "",
  place: null,
  radiusM: DEFAULT_RADIUS_M,
  token: null,
  amount: "",
  durationHours: 24,
};

const DraftContext = createContext<[BountyDraft, Dispatch<SetStateAction<BountyDraft>>] | null>(null);

export function DraftProvider({ children }: PropsWithChildren) {
  const state = useState(initialDraft);
  return <DraftContext.Provider value={state}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useDraft must be used inside DraftProvider");
  const [draft, setDraft] = value;
  const update = (patch: Partial<BountyDraft>) => setDraft((current) => ({ ...current, ...patch }));
  return { draft, update };
}
