import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { fetchWalletTokens, type Session, type WalletToken } from "@/auth/api";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; tokens: WalletToken[]; stale: boolean };

export function useWalletTokens(session: Session | null) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!session) return;
    const request = ++latest.current;
    try {
      const tokens = await fetchWalletTokens(session);
      if (request === latest.current) setState({ status: "ready", tokens, stale: false });
    } catch {
      if (request === latest.current) setState((current) => (current.status === "ready" ? { ...current, stale: true } : { status: "error" }));
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    void load();
  }, [load]);

  return { state, refreshing, refresh, retry };
}
