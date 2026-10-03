import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { useSession } from "@/auth/session-context";
import { FlowNotice } from "@/components/ui/Flow";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { Screen } from "@/components/ui/Screen";
import { deleteSavedDraft, draftGeneration, readSavedDraft, writeSavedDraft } from "@/post/draft-storage";
import { colors } from "@/theme";

import type { BountyToken } from "@/auth/api";
import { DEFAULT_RADIUS_M } from "@/post/options";

export type BountyPlace = { latitude: number; longitude: number; label: string };

export type BountyDraft = {
  taskMode: "remote" | "on_site";
  proofType: "written" | "photo";
  title: string;
  instructions: string;
  place: BountyPlace | null;
  radiusM: number;
  token: BountyToken | null;
  amount: string;
  durationHours: number;
};

const initialDraft: BountyDraft = {
  taskMode: "remote",
  proofType: "written",
  title: "",
  instructions: "",
  place: null,
  radiusM: DEFAULT_RADIUS_M,
  token: null,
  amount: "",
  durationHours: 24,
};

type DraftValue = {
  draft: BountyDraft;
  update: (patch: Partial<BountyDraft>) => void;
  reset: () => Promise<void>;
  clearSaved: () => Promise<void>;
  flush: () => Promise<void>;
};
const DraftContext = createContext<DraftValue | null>(null);

function restoreDraft(value: unknown): BountyDraft {
  if (value === null) return initialDraft;
  if (!value || typeof value !== "object") throw new Error("Draft could not be restored");
  const draft = { ...initialDraft, ...value } as BountyDraft;
  if (typeof draft.title !== "string" || typeof draft.instructions !== "string" || typeof draft.amount !== "string"
    || !["remote", "on_site"].includes(draft.taskMode) || !["written", "photo"].includes(draft.proofType)
    || !Number.isFinite(draft.durationHours) || !Number.isFinite(draft.radiusM)
    || (draft.place !== null && (typeof draft.place.label !== "string" || !Number.isFinite(draft.place.latitude) || !Number.isFinite(draft.place.longitude)))
    || (draft.token !== null && (typeof draft.token.mint !== "string" || !["SKR", "USDC"].includes(draft.token.symbol)
      || !Number.isInteger(draft.token.decimals) || draft.token.decimals < 0 || draft.token.decimals > 18)))
    throw new Error("Draft could not be restored");
  return draft;
}

export function DraftProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  return session ? <WalletDraftProvider key={session.walletAddress} wallet={session.walletAddress}>{children}</WalletDraftProvider> : <DraftLoading />;
}

function DraftLoading() {
  return <Screen><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View></Screen>;
}

function WalletDraftProvider({ wallet, children }: PropsWithChildren<{ wallet: string }>) {
  const generation = useRef(draftGeneration(wallet));
  const [draft, setDraft] = useState(initialDraft);
  const [hydration, setHydration] = useState<"loading" | "ready" | "error">("loading");
  const [saveError, setSaveError] = useState(false);
  const current = useRef(initialDraft);
  const dirty = useRef(false);
  const failedOperation = useRef<"save" | "clear" | null>(null);
  const version = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const stopTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const flush = useCallback(async () => {
    stopTimer();
    if (!dirty.current) return;
    const revision = version.current;
    const snapshot = current.current;
    dirty.current = false;
    try {
      await writeSavedDraft(wallet, snapshot, generation.current);
      failedOperation.current = null;
      if (mounted.current && revision === version.current) setSaveError(false);
    } catch (error) {
      failedOperation.current = "save";
      if (revision === version.current) dirty.current = true;
      if (mounted.current) setSaveError(true);
      throw error;
    }
  }, [wallet, stopTimer]);
  const update = useCallback((patch: Partial<BountyDraft>) => {
    // Only an explicit new edit can save a draft after account cleanup.
    generation.current = draftGeneration(wallet);
    current.current = { ...current.current, ...patch };
    version.current++;
    dirty.current = true;
    setDraft(current.current);
    stopTimer();
    timer.current = setTimeout(() => { void flush().catch(() => undefined); }, 180);
  }, [flush, stopTimer, wallet]);
  const clearSaved = useCallback(async () => {
    stopTimer();
    version.current++;
    dirty.current = false;
    try {
      await deleteSavedDraft(wallet);
      failedOperation.current = null;
      if (mounted.current) setSaveError(false);
    } catch (error) {
      failedOperation.current = "clear";
      if (mounted.current) setSaveError(true);
      throw error;
    }
  }, [wallet, stopTimer]);
  const reset = useCallback(async () => {
    await clearSaved();
    current.current = initialDraft;
    setDraft(initialDraft);
  }, [clearSaved]);
  const hydrate = useCallback(async () => {
    try {
      const saved = restoreDraft(await readSavedDraft(wallet));
      if (!mounted.current) return;
      current.current = saved;
      setDraft(saved);
      setHydration("ready");
    } catch { if (mounted.current) setHydration("error"); }
  }, [wallet]);
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(hydrate);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void flush().catch(() => undefined);
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      void flush().catch(() => undefined);
    };
  }, [hydrate, flush]);
  if (hydration === "loading") return <DraftLoading />;
  if (hydration === "error") return <Screen><View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
    <RetryMessage title="Couldn’t restore your draft" onRetry={() => { setHydration("loading"); void hydrate(); }} />
  </View></Screen>;
  return <DraftContext.Provider value={{ draft, update, reset, clearSaved, flush }}>
    {saveError ? <FlowNotice title="Couldn’t save your draft" message="Keep this screen open and retry."
      action={{ label: "Retry", onPress: () => void (failedOperation.current === "clear" ? clearSaved() : flush()).catch(() => undefined) }} /> : null}
    {children}
  </DraftContext.Provider>;
}

export function useDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error("useDraft must be used inside DraftProvider");
  return value;
}
