import { useCallback, useEffect, useState } from "react";

import { fetchBountyTokens, type BountyToken, type Session } from "@/auth/api";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; tokens: BountyToken[] };

export function useBountyTokens(session: Session | null) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!session) return;
    let active = true;
    fetchBountyTokens(session).then(
      (tokens) => active && setState({ status: "ready", tokens }),
      () => active && setState({ status: "error" }),
    );
    return () => {
      active = false;
    };
  }, [session, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  return { state, retry };
}
