import { router } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { BountyView } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { BountyList, BountyRow } from "@/components/ui/BountyRow";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/ui/Reveal";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { Heading } from "@/components/ui/Typography";
import { formatDistance, formatReward, formatTimeLeft } from "@/explore/format";
import { useCurrentPosition } from "@/explore/use-current-position";
import { useNearbyBounties } from "@/explore/use-nearby-bounties";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { TOKEN_META } from "@/post/options";
import { colors, fonts, layout } from "@/theme";

const SORTS = [
  { key: "nearest", label: "Nearest" },
  { key: "reward", label: "Top reward" },
  { key: "ending", label: "Ending soon" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const tokens = (b: BountyView) => Number(b.amount) / 10 ** b.decimals;

const SORTERS: Record<SortKey, (a: BountyView, b: BountyView) => number> = {
  nearest: (a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0),
  reward: (a, b) => tokens(b) - tokens(a),
  ending: (a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt),
};

export default function Explore() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const location = useLocationPermission();
  const position = useCurrentPosition(location.granted);
  const from = position.state.status === "ready" ? position.state.coords : null;
  const nearby = useNearbyBounties(session, from);
  const [sort, setSort] = useState<SortKey>("nearest");
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const sorted = useMemo(
    () => (nearby.state.status === "ready" ? [...nearby.state.bounties].sort(SORTERS[sort]) : []),
    [nearby.state, sort],
  );

  const refresh = async () => {
    setRefreshing(true);
    setNow(Date.now());
    await position.locate();
    await nearby.load();
    setRefreshing(false);
  };

  let body: ReactNode;
  if (location.permission === null) {
    body = null;
  } else if (!location.granted) {
    body = (
      <EmptyState
        style={styles.centered}
        title="Find bounties near you"
        message="Scoutvy uses your location to show bounties nearby and how far away they are."
        action={{ label: location.blocked ? "Open Settings" : "Allow Location", onPress: () => void location.request() }}
      />
    );
  } else if (position.state.status === "error") {
    body = <RetryMessage style={styles.centered} title="Couldn’t get your location" onRetry={position.retry} />;
  } else if (position.state.status === "locating" || nearby.state.status === "loading") {
    body = <ActivityIndicator style={styles.centered} color={colors.muted} />;
  } else if (nearby.state.status === "error") {
    body = <RetryMessage style={styles.centered} title="Couldn’t load bounties" onRetry={nearby.retry} />;
  } else if (sorted.length === 0) {
    body = (
      <EmptyState
        style={styles.centered}
        title="No bounties nearby"
        message="There are no open bounties within 25 km right now. Pull down to check again."
      />
    );
  } else {
    body = (
      <>
        <Reveal style={styles.sorts}>
          {SORTS.map((option) => (
            <Chip key={option.key} label={option.label} selected={sort === option.key} onPress={() => setSort(option.key)} />
          ))}
        </Reveal>
        <Reveal order={1}>
          <Heading style={styles.section}>Within 25 km</Heading>
        </Reveal>
        <Reveal order={2} style={styles.list}>
          <BountyList>
            {sorted.map((bounty) => (
              <BountyRow
                key={bounty.id}
                icon={TOKEN_META[bounty.symbol].icon}
                title={bounty.title}
                subtitle={[bounty.mine ? "Yours" : null, bounty.distanceM !== null ? formatDistance(bounty.distanceM) : null, bounty.locationLabel]
                  .filter(Boolean)
                  .join(" · ")}
                reward={formatReward(bounty)}
                timeLeft={formatTimeLeft(bounty.expiresAt, now)}
                onPress={() => router.push({ pathname: "/bounty/[id]", params: { id: bounty.id } })}
              />
            ))}
          </BountyList>
        </Reveal>
        {nearby.state.status === "ready" && nearby.state.stale ? (
          <Text style={styles.stale}>Couldn’t refresh. Showing the last loaded bounties.</Text>
        ) : null}
      </>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Heading>Explore</Heading>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          from ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.muted}
              colors={[colors.onPrimary]}
              progressBackgroundColor={colors.primary}
            />
          ) : undefined
        }
      >
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { marginTop: layout.navTop, height: layout.navHeight, justifyContent: "center" },
  content: { flexGrow: 1, paddingBottom: 24 },
  centered: { flex: 1, justifyContent: "center", paddingBottom: layout.navHeight + layout.navTop },
  sorts: { marginTop: 6, marginHorizontal: 16, flexDirection: "row", gap: 8 },
  section: { marginTop: 27 },
  list: { marginTop: 12 },
  stale: {
    marginTop: 14,
    marginHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
  },
});
