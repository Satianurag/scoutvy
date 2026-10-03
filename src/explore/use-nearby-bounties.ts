import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { fetchNearbyBounties, type BountyView, type Coordinates, type Session } from "@/auth/api";

type State =
  { status: "loading" } | { status: "error" } | { status: "ready"; bounties: BountyView[]; stale: boolean; mode: "remote" | "on_site" };

export function useNearbyBounties(session: Session | null, from: Coordinates | null, mode: "remote" | "on_site" = "on_site") {
  const [state, setState] = useState<State>({ status: "loading" });
  const latest = useRef(0);

  const load = useCallback(
    async (coords = from) => {
      if (!session || (mode === "on_site" && !coords)) return;
      const request = ++latest.current;
      try {
        const bounties = await fetchNearbyBounties(session, coords, mode);
        if (request === latest.current) setState({ status: "ready", bounties, stale: false, mode });
      } catch {
        if (request === latest.current)
          setState((current) =>
            current.status === "ready" && current.mode === mode ? { ...current, stale: true } : { status: "error" },
          );
      }
    },
    [session, from, mode],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        latest.current++;
      };
    }, [load]),
  );

  const retry = useCallback(() => {
    setState({ status: "loading" });
    void load();
  }, [load]);

  return { state: state.status === "ready" && state.mode !== mode ? { status: "loading" as const } : state, load, retry };
}
