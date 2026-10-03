import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchBounty, type BountyView, type Session } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { useAppDialog } from "@/components/ui/AppDialog";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { Screen } from "@/components/ui/Screen";
import { StatusView, statusEmphasis } from "@/components/ui/StatusView";
import { explorerAddressUrl } from "@/constants/app-config";
import { formatReward } from "@/explore/format";
import { useCloseBounty } from "@/explore/use-close-bounty";
import { FlowHeader, FlowFooter, flowStyles } from "@/components/ui/Flow";
import { BountyOverview } from "@/proof/BountyOverview";
import { ScoutAction } from "@/proof/ScoutAction";
import { colors, fonts } from "@/theme";

const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

const PENDING = {
  simulating: { title: "Checking…", message: "Making sure the reward can be returned." },
  signing: { title: "Approve in your wallet", message: "Confirm the transaction to return the reward." },
  confirming: { title: "Returning reward…", message: "Waiting for Solana to confirm the escrow is closed." },
} as const;

type LoadState =
  { status: "loading" } | { status: "error"; notFound: boolean } | { status: "ready"; bounty: BountyView };

async function viewerPosition() {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const position = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(
    () => null,
  );
  return position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : null;
}

export default function BountyDetail() {
  const { session } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!session || typeof id !== "string") return null;
  return <Detail key={id} session={session} id={id} />;
}

function Detail({ session, id }: { session: Session; id: string }) {
  const showDialog = useAppDialog();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [now, setNow] = useState(() => Date.now());
  const [accepting, setAccepting] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const bounty = state.status === "ready" ? state.bounty : null;
  const close = useCloseBounty(session, bounty);
  const closing = close.phase.kind !== "idle";
  const busy = closing && close.phase.kind !== "closed" && close.phase.kind !== "failed";

  const load = useCallback(async () => {
    try {
      setState({ status: "ready", bounty: await fetchBounty(session, id, await viewerPosition()) });
    } catch (error) {
      setState({
        status: "error",
        notFound: error instanceof Error && "status" in error && error.status === 404,
      });
    }
  }, [session, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const retry = () => {
    setState({ status: "loading" });
    void load();
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => busy || accepting);
    return () => subscription.remove();
  }, [busy, accepting]);

  if (closing && bounty) {
    const reward = <Text style={statusEmphasis.strong}>{formatReward(bounty)}</Text>;
    return (
      <Screen>
        {close.phase.kind === "closed" ? (
          <StatusView
            state="success"
            title="Reward returned"
            message={<>{reward} is back in your wallet.</>}
          />
        ) : close.phase.kind === "failed" ? (
          <StatusView state="failure" title="Couldn’t return reward" message={close.phase.message} />
        ) : close.phase.kind !== "idle" ? (
          <StatusView
            state="pending"
            title={PENDING[close.phase.kind].title}
            message={PENDING[close.phase.kind].message}
          />
        ) : null}
        <BottomActions>
          {close.phase.kind === "failed" ? (
            <Button label="Try Again" onPress={() => void close.run()} />
          ) : null}
          {busy ? null : <Button label="Close" variant="secondary" onPress={() => router.back()} />}
        </BottomActions>
      </Screen>
    );
  }

  if (!bounty) {
    return (
      <Screen>
        <FlowHeader title="Bounty details" />
        <View style={styles.centered}>
          {state.status === "loading" ? (
            <ActivityIndicator color={colors.muted} />
          ) : state.status === "error" && state.notFound ? (
            <Text style={styles.gone}>This bounty is no longer open.</Text>
          ) : (
            <RetryMessage title="Couldn’t load bounty" onRetry={retry} />
          )}
        </View>
      </Screen>
    );
  }

  const expired = Date.parse(bounty.expiresAt) <= now;
  const open = bounty.status === "open";
  const confirmClose = () => {
    const title = expired ? "Get your reward back?" : "Cancel this bounty?";
    const message = expired
      ? "The bounty has ended. The full reward goes back to your wallet."
      : "It closes now and the full reward goes back to your wallet.";
    showDialog({
      title,
      message,
      tone: expired ? "confirm" : "destructive",
      icon: expired ? "refund" : "trash",
      cancelLabel: expired ? "Not now" : "Keep bounty",
      confirmLabel: expired ? "Get refund" : "Cancel bounty",
      onConfirm: () => void close.run(),
    });
  };

  return (
    <Screen>
      <FlowHeader title="Bounty details" busy={accepting} />
      <ScrollView contentContainerStyle={flowStyles.content} showsVerticalScrollIndicator={false}>
        <BountyOverview
          bounty={bounty}
          now={now}
          onExplorer={() => void WebBrowser.openBrowserAsync(explorerAddressUrl(bounty.bountyAddress!))}
        />
        {!bounty.mine && (
          <Button
            label="Report bounty"
            variant="text"
            onPress={() => router.push({ pathname: "/report/[id]", params: { id: bounty.id } })}
          />
        )}
      </ScrollView>
      {bounty.mine && open ? (
        <FlowFooter
          label={expired ? "Get refund" : "Cancel bounty"}
          variant="secondary"
          onPress={confirmClose}
          note="Your wallet confirms the return of the escrow reward."
        />
      ) : null}
      {!bounty.mine ? <ScoutAction session={session} id={id} onBusy={setAccepting} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  gone: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, color: colors.text, textAlign: "center" },
});
