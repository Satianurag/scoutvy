import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchBounty, type BountyView, type Session } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { NavBar } from "@/components/ui/NavBar";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { Reveal } from "@/components/ui/Reveal";
import { Screen } from "@/components/ui/Screen";
import { StatusView, statusEmphasis } from "@/components/ui/StatusView";
import { SummaryCard, type SummaryItem } from "@/components/ui/SummaryCard";
import { explorerAddressUrl } from "@/constants/app-config";
import { formatDistance, formatReward, formatTimeLeft } from "@/explore/format";
import { useCloseBounty } from "@/explore/use-close-bounty";
import { formatEnds, formatRadius } from "@/post/options";
import { ScoutAction } from "@/proof/ScoutAction";
import { colors, fonts } from "@/theme";
import { formatUnits } from "@/wallet/format";

const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

const PENDING = {
  simulating: { title: "Checking…", message: "Making sure the reward can be returned." },
  signing: { title: "Approve in your wallet", message: "Confirm the transaction to return the reward." },
  confirming: { title: "Returning reward…", message: "Waiting for Solana to confirm the escrow is closed." },
} as const;

type LoadState = { status: "loading" } | { status: "error"; notFound: boolean } | { status: "ready"; bounty: BountyView };

async function viewerPosition() {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const position = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null);
  return position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : null;
}

export default function BountyDetail() {
  const { session } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!session || typeof id !== "string") return null;
  return <Detail session={session} id={id} />;
}

function Detail({ session, id }: { session: Session; id: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [now] = useState(() => Date.now());
  const bounty = state.status === "ready" ? state.bounty : null;
  const close = useCloseBounty(session, bounty);
  const closing = close.phase.kind !== "idle";
  const busy = closing && close.phase.kind !== "closed" && close.phase.kind !== "failed";

  const load = useCallback(async () => {
    try {
      setState({ status: "ready", bounty: await fetchBounty(session, id, await viewerPosition()) });
    } catch (error) {
      setState({ status: "error", notFound: error instanceof Error && "status" in error && error.status === 404 });
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
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => busy);
    return () => subscription.remove();
  }, [busy]);

  if (closing && bounty) {
    const reward = <Text style={statusEmphasis.strong}>{formatReward(bounty)}</Text>;
    return (
      <Screen>
        {close.phase.kind === "closed" ? (
          <StatusView state="success" title="Reward returned" message={<>{reward} is back in your wallet.</>} />
        ) : close.phase.kind === "failed" ? (
          <StatusView state="failure" title="Couldn’t return reward" message={close.phase.message} />
        ) : close.phase.kind !== "idle" ? (
          <StatusView state="pending" title={PENDING[close.phase.kind].title} message={PENDING[close.phase.kind].message} />
        ) : null}
        <BottomActions>
          {close.phase.kind === "failed" ? <Button label="Try Again" onPress={() => void close.run()} /> : null}
          {busy ? null : <Button label="Close" variant="secondary" onPress={() => router.back()} />}
        </BottomActions>
      </Screen>
    );
  }

  if (!bounty) {
    return (
      <Screen>
        <NavBar title="Bounty" />
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
  const info: SummaryItem[] = [
    { label: "Bounty", value: bounty.title },
    { label: "Area", value: bounty.locationLabel },
    ...(bounty.distanceM !== null ? [{ label: "Distance", value: formatDistance(bounty.distanceM) }] : []),
    { label: "Proof radius", value: formatRadius(bounty.radiusM) },
    { label: open ? "Ends" : "Ended", value: formatEnds(new Date(bounty.closedAt ?? bounty.expiresAt)) },
    { label: "Network", value: "Solana Devnet" },
  ];
  const caption = !open ? (bounty.status === "cancelled" ? "Cancelled" : "Refunded") : expired ? "Ended" : formatTimeLeft(bounty.expiresAt, now);

  const confirmClose = () => {
    const title = expired ? "Get your reward back?" : "Cancel this bounty?";
    const message = expired
      ? "The bounty has ended. The full reward goes back to your wallet."
      : "It closes now and the full reward goes back to your wallet.";
    Alert.alert(title, message, [
      { text: "Keep", style: "cancel" },
      { text: expired ? "Get Refund" : "Cancel Bounty", style: "destructive", onPress: () => void close.run() },
    ]);
  };

  return (
    <Screen>
      <NavBar title="Bounty" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Reveal>
          <AmountDisplay amount={formatUnits(bounty.amount, bounty.decimals)} symbol={bounty.symbol} caption={caption} />
        </Reveal>
        <Reveal order={1} style={styles.card}>
          <SummaryCard items={info} />
        </Reveal>
        <Reveal order={2} style={styles.card}>
          <SummaryCard items={[{ label: "Proof needed", value: bounty.instructions, stacked: true }]} />
        </Reveal>
        {bounty.bountyAddress ? (
          <Reveal order={3} style={styles.card}>
            <ListGroup>
              <ListRow
                label="View Escrow on Explorer"
                onPress={() => void WebBrowser.openBrowserAsync(explorerAddressUrl(bounty.bountyAddress!))}
              />
            </ListGroup>
          </Reveal>
        ) : null}
      </ScrollView>
      {bounty.mine && open ? (
        <BottomActions>
          <Button label={expired ? "Get Refund" : "Cancel Bounty"} variant="secondary" onPress={confirmClose} />
        </BottomActions>
      ) : null}
      {!bounty.mine ? <ScoutAction session={session} id={id} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 28, paddingBottom: 24 },
  card: { marginTop: 24 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  gone: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, color: colors.text, textAlign: "center" },
});
