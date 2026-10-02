import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { fetchScoutState, type ScoutState, type Session } from "@/auth/api";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { proofMessage } from "@/proof/errors";
import { useScoutClaim } from "@/proof/use-scout-claim";
import { colors, fonts } from "@/theme";

export function ScoutAction({ session, id }: { session: Session; id: string }) {
  const claim = useScoutClaim(session, id);
  const [scout, setScout] = useState<ScoutState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accepting = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setScout(await fetchScoutState(session, id));
    } catch (cause) {
      setError(proofMessage(cause));
    }
  }, [session, id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openProof = () => router.push({ pathname: scout?.status === "submitted" ? "/review/[id]" : "/proof/[id]", params: { id } });
  const accept = async () => {
    if (accepting.current) return;
    accepting.current = true;
    setBusy(true);
    setError(null);
    try {
      const state = await claim.run();
      if (!state) return;
      setScout(state);
      if (state.status === "accepted" || state.status === "submitted") router.push({
        pathname: state.status === "submitted" ? "/review/[id]" : "/proof/[id]", params: { id },
      });
    } catch (cause) {
      setError(proofMessage(cause));
      const state = await fetchScoutState(session, id).catch(() => null);
      if (state) setScout(state);
    } finally {
      accepting.current = false;
      setBusy(false);
    }
  };

  const label = !scout ? "Try Again" : scout.status === "accepted" ? "Continue to Proof"
    : scout.status === "submitted" ? "View Submission" : scout.status === "taken" ? "Accepted by Another Scout"
    : scout.status === "unavailable" ? "Bounty Unavailable" : scout.status === "reserved" ? "Retry Acceptance" : "Accept Bounty";

  return (
    <BottomActions>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      {scout?.status === "available" ? <Text style={styles.hint}>Accept to reveal the exact target. You’ll have up to 1 hour to submit.</Text> : null}
      <Button label={claim.phase || label} loading={busy || (!scout && !error)}
        disabled={scout?.status === "taken" || scout?.status === "unavailable"}
        onPress={!scout ? () => void load() : scout.status === "accepted" || scout.status === "submitted"
          ? openProof : () => void accept()} />
    </BottomActions>
  );
}

const styles = StyleSheet.create({
  error: { marginHorizontal: 24, fontFamily: fonts.regular, fontSize: 14.9, lineHeight: 20, color: colors.danger, textAlign: "center" },
  hint: { marginHorizontal: 32, fontFamily: fonts.regular, fontSize: 14.9, lineHeight: 20, color: colors.textSecondary, textAlign: "center" },
});
