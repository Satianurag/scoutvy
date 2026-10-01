import { useMobileWallet } from "@wallet-ui/react-native-kit";
import * as SecureStore from "expo-secure-store";
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

const ONBOARDED_KEY = "scoutvy-onboarded";

export type TierState = { status: "loading" } | { status: "ready"; tier: Tier } | { status: "error" };

type SessionContextValue = {
  isLoading: boolean;
  session: Session | null;
  profile: Profile | null;
  tier: TierState;
  onboarded: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshTier: () => Promise<void>;
  claimUsername: (username: string) => Promise<void>;
  finishOnboarding: () => Promise<void>;
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
  const [onboarded, setOnboarded] = useState(false);

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
      const [loaded, onboardedWallet] = await Promise.all([
        fetchProfile(active),
        SecureStore.getItemAsync(ONBOARDED_KEY),
      ]);
      setProfile(loaded);
      setOnboarded(onboardedWallet === active.walletAddress);
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
    setOnboarded(false);
  }, [wallet]);

  const refreshTier = useCallback(async () => {
    if (session) await loadTier(session);
  }, [session, loadTier]);

  const claimUsername = useCallback(
    async (username: string) => {
      if (!session) return;
      setProfile(await saveUsername(session, username));
    },
    [session],
  );

  const finishOnboarding = useCallback(async () => {
    if (!session) return;
    await SecureStore.setItemAsync(ONBOARDED_KEY, session.walletAddress);
    setOnboarded(true);
  }, [session]);

  const value = useMemo(
    () => ({
      isLoading,
      session,
      profile,
      tier,
      onboarded,
      signIn,
      signOut,
      refreshTier,
      claimUsername,
      finishOnboarding,
    }),
    [isLoading, session, profile, tier, onboarded, signIn, signOut, refreshTier, claimUsername, finishOnboarding],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
