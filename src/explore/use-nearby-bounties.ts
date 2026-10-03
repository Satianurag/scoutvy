import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import { fetchNearbyBounties, type BountyView, type Coordinates, type Session } from "@/auth/api";

type State =
  { status: "loading" } | { status: "error" } | { status: "ready"; bounties: BountyView[]; stale: boolean };

export function useNearbyBounties(session: Session | null, from: Coordinates | null) {
  const [state, setState] = useState<State>({ status: "loading" });
  const latest = useRef(0);

  const load = useCallback(
    async (coords = from) => {
      if (!session || !coords) return;
      const request = ++latest.current;
      try {
        const bounties = await fetchNearbyBounties(session, coords);
        if (request === latest.current) setState({ status: "ready", bounties, stale: false });
      } catch {
        if (request === latest.current)
          setState((current) =>
            current.status === "ready" ? { ...current, stale: true } : { status: "error" },
          );
      }
    },
    [session, from],
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

  return { state, load, retry };
}
