import { useMobileWallet } from "@wallet-ui/react-native-kit";
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import {
  fetchProfile,
  fetchSignInPayload,
  fetchTier,
  loadSession,
  saveUsername,
  signOut as endSession,
  verifySignIn,
  type Profile,
  type Session,
  type Tier,
} from "@/auth/api";

export type TierState = { status: "loading" } | { status: "ready"; tier: Tier } | { status: "error" };

type SessionContextValue = {
  isLoading: boolean;
  session: Session | null;
  profile: Profile | null;
  tier: TierState;
  justOnboarded: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshTier: () => Promise<void>;
  claimUsername: (username: string) => Promise<void>;
  finishOnboarding: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const value = use(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const wallet = useMobileWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tier, setTier] = useState<TierState>({ status: "loading" });
  const [justOnboarded, setJustOnboarded] = useState(false);

  const loadTier = useCallback(async (active: Session) => {
    setTier({ status: "loading" });
    try {
      setTier({ status: "ready", tier: await fetchTier(active) });
    } catch {
      setTier({ status: "error" });
    }
  }, []);

  const activate = useCallback(
    async (active: Session) => {
      const loaded = await fetchProfile(active);
      setProfile(loaded);
      setSession(active);
      void loadTier(active);
    },
    [loadTier],
  );

  useEffect(() => {
    loadSession()
      .then((restored) => (restored ? activate(restored) : undefined))
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, [activate]);

  const signIn = useCallback(async () => {
    const payload = await fetchSignInPayload();
    const output = await wallet.signIn(payload);
    await activate(await verifySignIn(payload.nonce, output));
  }, [wallet, activate]);

  const signOut = useCallback(async () => {
    await endSession();
    await wallet.disconnect().catch(() => undefined);
    setSession(null);
    setProfile(null);
    setTier({ status: "loading" });
    setJustOnboarded(false);
  }, [wallet]);

  const refreshTier = useCallback(async () => {
    if (session) await loadTier(session);
  }, [session, loadTier]);

  const claimUsername = useCallback(
    async (username: string) => {
      if (!session) return;
      const saved = await saveUsername(session, username);
      setJustOnboarded(true);
      setProfile(saved);
    },
    [session],
  );

  const finishOnboarding = useCallback(() => setJustOnboarded(false), []);

  const value = useMemo(
    () => ({
      isLoading,
      session,
      profile,
      tier,
      justOnboarded,
      signIn,
      signOut,
      refreshTier,
      claimUsername,
      finishOnboarding,
    }),
    [isLoading, session, profile, tier, justOnboarded, signIn, signOut, refreshTier, claimUsername, finishOnboarding],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
