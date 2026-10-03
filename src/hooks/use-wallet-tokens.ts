import { address } from "@solana/kit";
import { useMobileWallet } from "@wallet-ui/react-native-kit";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { fetchBountyTokens, fetchWalletTokens, type Session, type WalletToken } from "@/auth/api";
export type WalletNetwork = "devnet" | "mainnet";
type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; tokens: WalletToken[]; sol: string | null; stale: boolean };
export function useWalletTokens(session: Session | null, network: WalletNetwork = "mainnet") {
  const { client } = useMobileWallet();
  const key = `${session?.walletAddress}:${network}`;
  const [data, setData] = useState<{ key: string; state: State } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);
  const load = useCallback(async () => {
    if (!session) return;
    const request = ++latest.current;
    try {
      let tokens: WalletToken[],
        sol: string | null = null;
      if (network === "devnet") {
        const [balances, gas] = await Promise.all([
          fetchBountyTokens(session),
          client.rpc.getBalance(address(session.walletAddress)).send(),
        ]);
        tokens = balances.map((token) => ({ ...token, usdPrice: null, priceChange24h: null }));
        sol = String(gas.value);
      } else tokens = await fetchWalletTokens(session);
      if (request === latest.current) setData({ key, state: { status: "ready", tokens, sol, stale: false } });
    } catch {
      if (request === latest.current)
        setData((current) => ({
          key,
          state:
            current?.key === key && current.state.status === "ready"
              ? { ...current.state, stale: true }
              : { status: "error" },
        }));
    }
  }, [session, network, client.rpc, key]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        latest.current++;
      };
    }, [load]),
  );
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);
  const retry = useCallback(() => {
    setData({ key, state: { status: "loading" } });
    void load();
  }, [key, load]);
  const state: State = data?.key === key ? data.state : { status: "loading" };
  return { state, refreshing, refresh, retry };
}
