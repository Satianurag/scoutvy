import { useNavigation } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo } from "react";
import { BackHandler, Text } from "react-native";

import type { NewBounty } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { StatusView, statusEmphasis } from "@/components/ui/StatusView";
import { explorerTransactionUrl } from "@/constants/app-config";
import { useDraft } from "@/post/draft";
import { normalizeAmount } from "@/post/amount";
import { usePostBounty } from "@/post/use-post-bounty";

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
  if (!session || !token || !place) return null;
  return (
    <Posting
      session={session}
      input={{
        title: draft.title.trim(),
        instructions: draft.instructions.trim(),
        latitude: place.latitude,
        longitude: place.longitude,
        locationLabel: place.label,
        radiusM: draft.radiusM,
        mint: token.mint,
        amount: normalizeAmount(draft.amount),
        durationHours: draft.durationHours,
      }}
      symbol={token.symbol}
    />
  );
}

function Posting({ session, input, symbol }: { session: NonNullable<ReturnType<typeof useSession>["session"]>; input: NewBounty; symbol: string }) {
  const navigation = useNavigation();
  const stable = useMemo(() => input, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { phase, run } = usePostBounty(session, stable);
  const busy = phase.kind !== "open" && phase.kind !== "failed";

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => busy);
    return () => subscription.remove();
  }, [busy]);

  const close = () => navigation.getParent()?.goBack();
  const reward = (
    <Text style={statusEmphasis.strong}>
      {input.amount} {symbol}
    </Text>
  );

  return (
    <Screen>
      {phase.kind === "open" ? (
        <StatusView
          state="success"
          title="Bounty posted!"
          message={<>{reward} is locked for “{phase.bounty.title}”. Scouts nearby can now take it.</>}
          link={{ label: "View transaction", onPress: () => void WebBrowser.openBrowserAsync(explorerTransactionUrl(phase.signature)) }}
        />
      ) : phase.kind === "failed" ? (
        <StatusView state="failure" title="Couldn’t post bounty" message={phase.message} />
      ) : (
        <StatusView state="pending" title={PENDING[phase.kind].title} message={PENDING[phase.kind].message} />
      )}
      <BottomActions>
        {phase.kind === "failed" ? <Button label="Try Again" onPress={() => void run()} /> : null}
        {busy ? null : <Button label="Close" variant="secondary" onPress={close} />}
      </BottomActions>
    </Screen>
  );
}
