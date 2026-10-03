import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchScoutState, type ScoutState, type Session } from "@/auth/api";
import { useAppDialog } from "@/components/ui/AppDialog";
import { FlowFooter, FlowNotice } from "@/components/ui/Flow";
import { proofMessage } from "@/proof/errors";
import { useScoutClaim } from "@/proof/use-scout-claim";

export function ScoutAction({
  session,
  id,
  onBusy,
}: {
  session: Session;
  id: string;
  onBusy: (busy: boolean) => void;
}) {
  const showDialog = useAppDialog();
  const claim = useScoutClaim(session, id);
  const [scout, setScout] = useState<ScoutState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accepting = useRef(false);
  useEffect(() => {
    onBusy(busy);
  }, [busy, onBusy]);
  const load = useCallback(async () => {
    setError(null);
    try {
      setScout(await fetchScoutState(session, id));
    } catch (cause) {
      setError(proofMessage(cause));
    }
  }, [session, id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    if (scout?.status !== "accepted" && scout?.status !== "reserved") return;
    const delay = Date.parse(scout.expiresAt) - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(() => void load(), delay + 1000);
    return () => clearTimeout(timer);
  }, [scout, load]);
  const openProof = () =>
    router.push({ pathname: scout?.status === "submitted" ? "/review/[id]" : "/proof/[id]", params: { id } });
  const accept = async () => {
    if (accepting.current) return;
    accepting.current = true;
    setBusy(true);
    setError(null);
    try {
      const state = await claim.run();
      if (!state) return;
      setScout(state);
      if (state.status === "accepted" || state.status === "submitted")
        router.push({
          pathname: state.status === "submitted" ? "/review/[id]" : "/proof/[id]",
          params: { id },
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
  const confirmAcceptance = () =>
    showDialog({
      title: "Ready to scout?",
      message:
        "Accept to reveal the exact target. You’ll have up to 1 hour to arrive and submit a fresh photo. Your wallet will show the devnet network costs before you approve.",
      tone: "confirm",
      icon: "approve",
      confirmLabel: "Accept & reveal location",
      cancelLabel: "Keep browsing",
      onConfirm: () => void accept(),
    });
  const unavailable = scout?.status === "taken" || scout?.status === "unavailable";
  const label = !scout
    ? "Try again"
    : scout.status === "accepted"
      ? "Continue to proof"
      : scout.status === "submitted"
        ? "View submission"
        : unavailable
          ? "Back to Explore"
          : scout.status === "reserved"
            ? "Continue acceptance"
            : "Accept bounty";
  const note = busy
    ? claim.phase
    : scout?.status === "taken"
      ? "Another scout is working on this bounty."
      : scout?.status === "unavailable"
        ? "This bounty is no longer accepting scouts."
        : scout?.status === "reserved"
          ? "Your acceptance needs confirmation. Continue where you left off."
          : "";
  return (
    <FlowFooter
      label={label}
      loading={busy || (!scout && !error)}
      note={note}
      onPress={
        unavailable
          ? () => router.replace("/(tabs)/explore")
          : !scout
            ? () => void load()
            : scout.status === "accepted" || scout.status === "submitted"
              ? openProof
              : confirmAcceptance
      }
    >
      {error ? (
        <FlowNotice
          error
          title="Couldn’t complete acceptance"
          message={error}
          action={{ label: "Refresh availability", onPress: () => void load() }}
        />
      ) : null}
    </FlowFooter>
  );
}
