import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchActivity, type ActivityEvent } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { BountyList, BountyRow } from "@/components/ui/BountyRow";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { Heading } from "@/components/ui/Typography";
import { TOKEN_META } from "@/post/options";
import { colors, fonts, layout } from "@/theme";
import { formatUnits } from "@/wallet/format";

const labels: Record<string, string> = {
  posted: "Bounty posted", accepted: "Bounty accepted", review: "Proof to review", submitted: "Proof submitted",
  protected: "Escrow protected", disputed: "Proof disputed", decision_prepared: "Awaiting wallet decision",
  retry: "Settlement needs retry", paid: "Reward paid", refunded: "Reward refunded",
  cancelled: "Cancelled · refunded", expired: "Expired · refunded", expired_open: "Expired · refund available",
};
const reviewKinds = new Set(["review", "submitted", "protected", "disputed", "decision_prepared", "retry", "paid", "refunded"]);
function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? "Yesterday" : date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export default function Activity() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const [data, setData] = useState<{ wallet: string; events: ActivityEvent[]; next: string | null } | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const requestId = useRef(0);
  const loaded = data?.wallet === session?.walletAddress ? data : null;
  const load = useCallback(async (before?: string) => {
    if (!session) return;
    const current = ++requestId.current;
    setError(false);
    try {
      const page = await fetchActivity(session, before);
      if (current !== requestId.current) return;
      setData((previous) => ({ wallet: session.walletAddress, next: page.next,
        events: before && previous?.wallet === session.walletAddress
          ? [...previous.events, ...page.events.filter((event) => !previous.events.some((item) => item.id === event.id))] : page.events }));
    } catch { if (current === requestId.current) setError(true); }
  }, [session]);
  useFocusEffect(useCallback(() => { void load(); return () => { requestId.current++; }; }, [load]));
  const groups = useMemo(() => {
    const rows = new Map<string, ActivityEvent[]>();
    for (const event of loaded?.events ?? []) {
      const label = dayLabel(event.at);
      rows.set(label, [...rows.get(label) ?? [], event]);
    }
    return [...rows.entries()];
  }, [loaded]);
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}><Heading>Activity</Heading></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}>
        {!loaded ? <View style={styles.center}>{error ? <RetryMessage title="Couldn’t load activity" onRetry={() => void load()} />
          : <ActivityIndicator color={colors.primary} />}</View>
          : loaded.events.length === 0 ? <EmptyState style={styles.center} title="Your next adventure starts here"
            message="Posted bounties, submitted proof and confirmed rewards will appear here."
            action={{ label: "Explore Bounties", onPress: () => router.navigate("/(tabs)/explore") }} />
            : groups.map(([label, events]) => <View key={label} style={styles.group}>
              <Heading style={styles.date}>{label}</Heading>
              <BountyList>{events.map((event) => {
                return <BountyRow key={event.id} icon={TOKEN_META[event.symbol].icon}
                  title={labels[event.kind] ?? "Bounty update"} subtitle={event.title}
                  reward={`${formatUnits(event.amount, event.decimals)} ${event.symbol}`}
                  timeLeft={new Date(event.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  onPress={() => router.push({ pathname: reviewKinds.has(event.kind) ? "/review/[id]" : "/bounty/[id]", params: { id: event.bountyId } })} />;
              })}</BountyList>
            </View>)}
        {loaded && error ? <Text style={styles.error}>Couldn’t refresh. Showing the last loaded activity.</Text> : null}
        {loaded?.next ? <View style={styles.more}><Button label="Load More" variant="secondary" loading={more} onPress={async () => {
          setMore(true); await load(loaded.next!); setMore(false);
        }} /></View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { marginTop: layout.navTop, height: layout.navHeight, justifyContent: "center" },
  content: { flexGrow: 1, paddingBottom: 24 },
  center: { flex: 1, justifyContent: "center", paddingBottom: 56 },
  group: { marginTop: 24 },
  date: { marginBottom: 12, fontSize: 16, lineHeight: 22, color: colors.textSecondary },
  more: { marginTop: 24 }, error: { margin: 20, color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 15, textAlign: "center" },
});
