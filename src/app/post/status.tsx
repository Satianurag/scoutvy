import { Redirect, router, useNavigation } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef } from "react";
import { BackHandler, Text, View } from "react-native";

import type { NewBounty } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { StatusView, statusEmphasis } from "@/components/ui/StatusView";
import { explorerTransactionUrl } from "@/constants/app-config";
import { useDraft } from "@/post/draft";
import { normalizeAmount, toBaseUnits } from "@/post/amount";
import { usePostBounty } from "@/post/use-post-bounty";
import { NetworkBadge, PostNote } from "@/post/ui";
import { formatUnits } from "@/wallet/format";

const PENDING = {
  saving: { title: "Saving bounty…", message: "Getting your bounty ready." },
  simulating: { title: "Checking…", message: "Making sure the reward can be locked." },
  signing: { title: "Approve in your wallet", message: "Confirm the transaction to lock the reward." },
  confirming: { title: "Posting…", message: "Waiting for Solana to confirm the reward is locked." },
} as const;

export default function PostStatus() {
  const { session } = useSession();
  const { draft } = useDraft();
  const { token, place } = draft;
  if (!session) return null;
  if (!token || (draft.taskMode === "on_site" && !place) || draft.title.trim().length < 4 || draft.instructions.trim().length < 10 || toBaseUnits(draft.amount, token.decimals) === 0n) return <Redirect href="/post/review" />;
  return (
    <Posting
      session={session}
      input={{
        title: draft.title.trim(),
        instructions: draft.instructions.trim(),
        taskMode: draft.taskMode,
        proofType: draft.proofType,
        latitude: draft.taskMode === "on_site" ? place!.latitude : null,
        longitude: draft.taskMode === "on_site" ? place!.longitude : null,
        locationLabel: draft.taskMode === "on_site" ? place!.label : null,
        radiusM: draft.taskMode === "on_site" ? draft.radiusM : null,
        mint: token.mint,
        amount: toBaseUnits(draft.amount, token.decimals).toString(),
        durationHours: draft.durationHours,
      }}
      reward={`${normalizeAmount(draft.amount)} ${token.symbol}`}
    />
  );
}

function Posting({
  session,
  input,
  reward: rewardLabel,
}: {
  session: NonNullable<ReturnType<typeof useSession>["session"]>;
  input: NewBounty;
  reward: string;
}) {
  const navigation = useNavigation();
  const stable = useMemo(() => input, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { phase, run } = usePostBounty(session, stable);
  const { clearSaved } = useDraft();
  const started = useRef(false);
  const cleared = useRef(false);
  const busy = phase.kind !== "open" && phase.kind !== "failed" && phase.kind !== "ready";

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  useEffect(() => {
    if (phase.kind !== "open" || cleared.current) return;
    cleared.current = true;
    void clearSaved().catch(() => undefined);
  }, [phase.kind, clearSaved]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (phase.kind === "open") {
        navigation.getParent()?.goBack();
        return true;
      }
      return busy;
    });
    return () => subscription.remove();
  }, [busy, navigation, phase.kind]);

  const close = () => navigation.getParent()?.goBack();
  const confirmedReward = phase.kind === "open"
    ? `${formatUnits(phase.bounty.amount, 6)} ${phase.bounty.mint === "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" ? "USDC" : "SKR"}`
    : rewardLabel;
  const reward = <Text style={statusEmphasis.strong}>{confirmedReward}</Text>;

  return (
    <Screen>
      <View style={{ marginTop: 24 }}>
        <NetworkBadge />
      </View>
      {phase.kind === "open" ? (
        <StatusView
          state="success"
          title="Bounty posted!"
          message={
            <>
              {reward} is locked in escrow for “{phase.bounty.title}”.
            </>
          }
          link={{
            label: "View transaction",
            onPress: () => void WebBrowser.openBrowserAsync(explorerTransactionUrl(phase.signature)),
          }}
        />
      ) : phase.kind === "failed" ? (
        <StatusView
          state="failure"
          title={phase.signature ? "Confirmation pending" : "Couldn’t post bounty"}
          message={phase.message}
          link={
            phase.signature
              ? {
                  label: "View transaction",
                  onPress: () => void WebBrowser.openBrowserAsync(explorerTransactionUrl(phase.signature!)),
                }
              : undefined
          }
        />
      ) : (
        <StatusView state="pending" title={PENDING[phase.kind === "ready" ? "confirming" : phase.kind].title} message={PENDING[phase.kind === "ready" ? "confirming" : phase.kind].message} />
      )}
      <BottomActions>
        {phase.kind === "open" ? (
          <>
            <PostNote title="Your bounty is live">
              Track progress and review submissions from the bounty details.
            </PostNote>
            <Button
              label="View bounty"
              onPress={() => {
                router.dismissAll();
                router.push({ pathname: "/bounty/[id]", params: { id: phase.bounty.id } });
              }}
            />
          </>
        ) : null}
        {phase.kind === "failed" ? (
          <Button label={phase.signature ? "Check confirmation" : "Try again"} onPress={() => void run()} />
        ) : null}
        {phase.kind === "failed" && !phase.signature ? (
          <Button label="Back to review" variant="secondary" onPress={() => router.back()} />
        ) : null}
        {busy ? null : <Button label="Close" variant="secondary" onPress={close} />}
      </BottomActions>
    </Screen>
  );
}
