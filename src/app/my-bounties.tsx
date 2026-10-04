import { useCallback, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { fetchMyBounties, type MyBounty } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { useResource } from "@/hooks/use-resource";
import { Screen } from "@/components/ui/Screen";
import { FlowHeader, FlowPill, FlowNotice } from "@/components/ui/Flow";
import { BrowseEmpty, Choice, SearchBox, browseStyles } from "@/components/ui/Browse";
import { Button } from "@/components/ui/Button";
import { settingsStyle as s } from "@/settings/ui";
import { colors, fonts } from "@/theme";
import { formatReward } from "@/explore/format";
function state(b: MyBounty) {
  if (b.status === "paid") return "Paid";
  if (b.status === "refunded") return "Refunded";
  if (b.status === "cancelled") return "Cancelled";
  if (b.status === "expired") return "Refunded";
  if (b.proofStatus === "paid") return "Paid";
  if (b.proofStatus === "refunded") return "Refunded";
  if (b.proofStatus === "disputed") return "Disputed";
  if (b.proofStatus === "pending_review") return b.proofProtected ? "In review" : "Confirmation pending";
  if (Date.parse(b.expiresAt) <= Date.now()) return b.mine ? "Refund available" : "Expired";
  if (!b.mine && b.scoutExpiresAt && Date.parse(b.scoutExpiresAt) <= Date.now()) return "Window ended";
  return b.mine ? "Open" : "Accepted";
}
export default function MyBounties() {
  const { session } = useSession();
  const fetcher = useCallback(() => fetchMyBounties(session!), [session]);
  const r = useResource(session?.walletAddress ?? "", fetcher);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [filter, setFilter] = useState("all");
  const [older, setOlder] = useState<{ base: unknown; items: MyBounty[]; next: string | null } | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const pages = older?.base === r.data ? older : null;
  const all = useMemo(() => [...(r.data?.bounties ?? []), ...(pages?.items ?? [])], [r.data, pages]);
  const next = pages ? pages.next : r.data?.next;
  const filtered = all.filter(
    (b) =>
      (role === "all" || (role === "posted" ? b.mine : !b.mine)) &&
      `${b.title} ${b.locationLabel ?? "Online"}`.toLowerCase().includes(query.toLowerCase().trim()) &&
      (filter === "all" ||
        (filter === "active"
          ? ["Open", "Accepted", "Confirmation pending", "In review", "Disputed", "Refund available"].includes(state(b))
          : !["Open", "Accepted", "Confirmation pending", "In review", "Disputed", "Refund available"].includes(state(b)))),
  );
  const loadMore = async () => {
    if (!next || lock.current || r.loading) return;
    lock.current = true;
    setMore(true);
    setError(false);
    try {
      const page = await fetchMyBounties(session!, next);
      setOlder({
        base: r.data,
        items: [...(pages?.items ?? []), ...page.bounties.filter((b) => !all.some((x) => x.id === b.id))],
        next: page.next,
      });
    } catch {
      setError(true);
    } finally {
      setMore(false);
      lock.current = false;
    }
  };
  return (
    <Screen>
      <FlowHeader title="My bounties" />
      <SearchBox value={query} onChange={setQuery} placeholder="Search your bounties" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={[browseStyles.choices, { paddingVertical: 14 }]}
      >
        {[
          ["all", "All"],
          ["posted", "Posted"],
          ["scouting", "Accepted"],
        ].map(([id, label]) => (
          <Choice key={id} label={label} selected={role === id} onPress={() => setRole(id)} />
        ))}
      </ScrollView>
      <View style={[browseStyles.choices, { flexWrap: "wrap", marginBottom: 16 }]}>
        {[
          ["all", "Any status"],
          ["active", "Active"],
          ["done", "Closed"],
        ].map(([id, label]) => (
          <Choice key={id} label={label} selected={filter === id} onPress={() => setFilter(id)} />
        ))}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={r.loading && !!r.data}
            onRefresh={() => {
              if (!more) void r.refresh();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {!r.data ? (
          r.loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <BrowseEmpty
              title="Couldn’t load bounties"
              message="Check your connection and try again."
              action={{ label: "Retry", onPress: () => void r.refresh() }}
            />
          )
        ) : !filtered.length ? (
          <BrowseEmpty
            title={all.length ? "No matches" : "Your bounties live here"}
            message={
              all.length ? "Try another search or filter." : "Posted and accepted bounties appear here."
            }
            action={{
              label: all.length ? "Clear filters" : "Explore bounties",
              onPress: () =>
                all.length
                  ? (setQuery(""), setRole("all"), setFilter("all"))
                  : router.navigate("/(tabs)/explore"),
            }}
          />
        ) : (
          filtered.map((b) => (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: b.proofStatus ? "/review/[id]" : "/bounty/[id]",
                  params: { id: b.id },
                })
              }
              style={({ pressed }) => [s.card, pressed && { backgroundColor: colors.surfaceRaised }]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <FlowPill
                  label={state(b)}
                  tone={state(b) === "Paid" ? "green" : state(b) === "Disputed" ? "orange" : "purple"}
                />
                <Text style={[s.value, { fontFamily: fonts.semiBold }]}>{formatReward(b)}</Text>
              </View>
              <Text numberOfLines={3} style={[s.value, { fontFamily: fonts.display, fontSize: 22, lineHeight: 29 }]}>
                {b.title}
              </Text>
              <Text numberOfLines={1} style={[s.body, { marginHorizontal: 0, fontSize: 12 }]}>
                {[b.mine ? "Posted by you" : "Accepted by you", b.locationLabel].filter(Boolean).join(" · ")}
              </Text>
            </Pressable>
          ))
        )}
        {(error || (r.error && r.data)) && (
          <FlowNotice
            title="Couldn’t refresh"
            message="Your loaded bounties are still available."
            action={{ label: "Retry", onPress: () => void (error ? loadMore() : r.refresh()) }}
          />
        )}
        {next && (
          <Button
            label="Load older bounties"
            variant="secondary"
            loading={more}
            onPress={() => void loadMore()}
          />
        )}
      </ScrollView>
    </Screen>
  );
}
