import { disablePush, renewPush } from "@/notifications/service";
import { useMobileWallet } from "@wallet-ui/react-native-kit";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import {
  ApiError,
  fetchProfile,
  fetchSignInPayload,
  fetchTier,
  loadSession,
  persistSession,
  saveUsername,
  signOut as endSession,
  verifySignIn,
  type Profile,
  type Session,
  type Tier,
} from "@/auth/api";

import { subscribeUnauthorized } from "@/auth/session-events";
import { classifyWalletError, walletFailureMessage } from "@/auth/wallet-errors";
import { runWalletOperation, walletOperationBusy } from "@/wallet/operation";

export type TierState = { status: "loading" } | { status: "ready"; tier: Tier } | { status: "error" };

type SessionContextValue = {
  startupIssue: "connection" | "expired" | null;
  restoringSession: boolean;
  retryStartup: () => Promise<void>;
  pushRecoveryVisible: boolean;
  renewingPush: boolean;
  retryPush: () => Promise<void>;
  dismissPushRecovery: () => void;
  recoveryVisible: boolean;
  reauthenticating: boolean;
  recoveryError: string | null;
  reconnect: () => Promise<void>;
  dismissRecovery: () => void;
  isLoading: boolean;
  session: Session | null;
  profile: Profile | null;
  tier: TierState;
  onboarded: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshTier: () => Promise<void>;
  claimUsername: (username: string) => Promise<void>;
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
  const [startupIssue, setStartupIssue] = useState<"connection" | "expired" | null>(null);
  const [restoringSession, setRestoringSession] = useState(false);
  const restoring = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tier, setTier] = useState<TierState>({ status: "loading" });
  const onboarded = session !== null && !!profile?.username;
  const activeSession = useRef<Session | null>(null);
  const reconnecting = useRef(false);
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [reauthenticating, setReauthenticating] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [pushRecoveryVisible, setPushRecoveryVisible] = useState(false);
  const [renewingPush, setRenewingPush] = useState(false);
  const renewingToken = useRef<string | null>(null);
  const retryPush = useCallback(async () => {
    const active = activeSession.current;
    if (!active || renewingToken.current === active.token) return;
    renewingToken.current = active.token;
    setRenewingPush(true);
    try {
      await renewPush(active);
      if (activeSession.current?.token === active.token) setPushRecoveryVisible(false);
    } catch {
      if (activeSession.current?.token === active.token) setPushRecoveryVisible(true);
    } finally {
      if (renewingToken.current === active.token) {
        renewingToken.current = null;
        setRenewingPush(false);
      }
    }
  }, []);
  const dismissPushRecovery = useCallback(() => setPushRecoveryVisible(false), []);

  useEffect(() => subscribeUnauthorized((token) => {
    if (activeSession.current?.token !== token) return;
    setRecoveryVisible(true);
  }), []);

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
      activeSession.current = active;
      setSession(active);
      setStartupIssue(null);
      setRecoveryVisible(false);
      setRecoveryError(null);
      void loadTier(active);
      setPushRecoveryVisible(false);
      void retryPush();
    },
    [loadTier, retryPush],
  );

  const retryStartup = useCallback(async () => {
    if (restoring.current) return;
    restoring.current = true;
    setRestoringSession(true);
    try {
      const restored = await loadSession();
      if (restored) await activate(restored);
      setStartupIssue(null);
    } catch (error) {
      setStartupIssue(error instanceof ApiError && error.status === 401 ? "expired" : "connection");
    } finally {
      restoring.current = false;
      setRestoringSession(false);
      setIsLoading(false);
    }
  }, [activate]);
  useEffect(() => {
    void Promise.resolve().then(retryStartup);
  }, [retryStartup]);

  const signIn = useCallback(async () => {
    const payload = await fetchSignInPayload();
    const output = await runWalletOperation(() => wallet.signIn(payload));
    await activate(await verifySignIn(payload.nonce, output));
  }, [wallet, activate]);

  const reconnect = useCallback(async () => {
    const previous = activeSession.current;
    if (!previous || reconnecting.current || walletOperationBusy()) return;
    reconnecting.current = true;
    setReauthenticating(true);
    setRecoveryError(null);
    try {
      const payload = await fetchSignInPayload();
      const output = await runWalletOperation(() => wallet.signIn(payload));
      const fresh = await verifySignIn(payload.nonce, output, previous.walletAddress, false);
      // Signing out or switching sessions while the wallet was open cancels this replacement.
      if (activeSession.current?.token !== previous.token) return;
      await persistSession(fresh);
      activeSession.current = fresh;
      setSession(fresh);
      setRecoveryVisible(false);
      setPushRecoveryVisible(false);
      void retryPush();
      // Keep profile/onboarding and current route mounted. Failed operations remain user-controlled.
    } catch (error) {
      setRecoveryError(error instanceof ApiError && error.code === "wrong_wallet"
        ? "Choose the same wallet you were using in Scoutvy."
        : walletFailureMessage[classifyWalletError(error)]);
    } finally {
      reconnecting.current = false;
      setReauthenticating(false);
    }
  }, [wallet, retryPush]);
  const dismissRecovery = useCallback(() => {
    if (!reconnecting.current) setRecoveryVisible(false);
  }, []);

  const signOut = useCallback(async () => {
    setStartupIssue(null);
    setRecoveryVisible(false);
    setPushRecoveryVisible(false);
    setRecoveryError(null);
    if (session) await disablePush(session).catch(() => undefined);
    await endSession();
    activeSession.current = null;
    await runWalletOperation(() => wallet.disconnect()).catch(() => undefined);
    setSession(null);
    setProfile(null);
    setTier({ status: "loading" });
  }, [wallet, session]);

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

  const value = useMemo(
    () => ({
      startupIssue, restoringSession, retryStartup,
      pushRecoveryVisible, renewingPush, retryPush, dismissPushRecovery,
      recoveryVisible, reauthenticating, recoveryError, reconnect, dismissRecovery,
      isLoading,
      session,
      profile,
      tier,
      onboarded,
      signIn,
      signOut,
      refreshTier,
      claimUsername,
    }),
    [
      startupIssue, restoringSession, retryStartup,
      pushRecoveryVisible, renewingPush, retryPush, dismissPushRecovery,
      recoveryVisible, reauthenticating, recoveryError, reconnect, dismissRecovery,
      isLoading,
      session,
      profile,
      tier,
      onboarded,
      signIn,
      signOut,
      refreshTier,
      claimUsername,
    ],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
