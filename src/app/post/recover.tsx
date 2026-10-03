import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSession } from "@/auth/session-context";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { BrowseEmpty } from "@/components/ui/Browse";
import { FlowCard, FlowDetail, FlowHeader } from "@/components/ui/Flow";
import { Screen } from "@/components/ui/Screen";
import { StatusView } from "@/components/ui/StatusView";
import { usePostBounty } from "@/post/use-post-bounty";

import { colors, fonts, layout } from "@/theme";
import { formatUnits } from "@/wallet/format";

export default function RecoverPost() {
  const { session } = useSession();
  return session ? <Recovery session={session} /> : null;
}

function Recovery({ session }: { session: NonNullable<ReturnType<typeof useSession>["session"]> }) {
  const { phase, run, discard } = usePostBounty(session);
  const started = useRef(false);
  const [discardError, setDiscardError] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const busy = discarding || !["ready", "open", "failed"].includes(phase.kind);
  useEffect(() => {
    if (!started.current) { started.current = true; void run(true); }
  }, [run]);
  const ready = phase.kind === "ready" ? phase : null;
  const empty = phase.kind === "failed" && phase.reason === "no_pending";
  return <Screen>
    <FlowHeader title="Your bounty" busy={busy} />
    {empty ? <BrowseEmpty title="Nothing to recover" message="You have no unfinished bounty."
      action={{ label: "Post a bounty", onPress: () => router.replace("/post") }} /> : ready ? <ScrollView>
      <View style={{ margin: 20, gap: 10 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.semiBold, fontSize: 24 }}>{ready.bounty.title}</Text>
        <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 15 }}>
          {ready.canPost ? "Payment hasn’t completed. Continue or discard this draft."
            : ready.canDiscard ? "This deadline is too close. Discard this draft and post again."
              : "Your previous payment may still complete. Check confirmation again in a moment."}
        </Text>
      </View>
      <FlowCard>
        <FlowDetail label="Reward" value={`${formatUnits(ready.bounty.amount, 6)} ${ready.bounty.mint === "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" ? "USDC" : "SKR"}`} />
        <FlowDetail label="Location" value={ready.bounty.locationLabel ?? "Online"} last />
      </FlowCard>
    </ScrollView> : <StatusView state={phase.kind === "open" ? "success" : phase.kind === "failed" ? "failure" : "pending"}
      title={phase.kind === "open" ? "Bounty recovered" : phase.kind === "failed" ? "Couldn’t finish yet" : phase.kind === "signing" ? "Approve in your wallet" : "Checking your bounty…"}
      message={phase.kind === "failed" ? phase.message : phase.kind === "open" ? phase.bounty.title : "Your payment stays linked to this bounty."} />}
    <BottomActions>
      {discardError ? <Text style={{ color: colors.orange, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, marginHorizontal: layout.gutter }}>Couldn’t check the payment. Try again.</Text> : null}
      {phase.kind === "open" ? <Button label="View bounty" onPress={() => {
        router.dismissAll(); router.push({ pathname: "/bounty/[id]", params: { id: phase.bounty.id } });
      }} /> : null}
      {ready?.canPost ?
        <Button label="Continue posting" disabled={busy} onPress={() => void run()} /> : null}
      {(phase.kind === "failed" && !empty) || ready ? <Button label="Check confirmation" variant="secondary" disabled={busy} onPress={() => void run(true)} /> : null}
      {ready?.canDiscard ? <Button label="Discard draft" variant="secondary" disabled={busy} onPress={async () => {
        setDiscarding(true); setDiscardError(false);
        try { if (await discard()) router.back(); } catch { setDiscardError(true); }
        finally { setDiscarding(false); }
      }} /> : null}
    </BottomActions>
  </Screen>;
}
