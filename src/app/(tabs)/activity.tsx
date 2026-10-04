import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchActivity, type ActivityEvent } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import {
  ActivityDetails,
  ActivityItem,
  eventLabels,
  reviewKinds,
  rewardKinds,
} from "@/activity/ActivityItem";
import { BrowseEmpty, BrowseHeading, Choice, SearchBox, browseStyles as s } from "@/components/ui/Browse";
import { FlowNotice } from "@/components/ui/Flow";
import { Button } from "@/components/ui/Button";
import { colors } from "@/theme";
function dayLabel(value: string) {
  const date = new Date(value),
    today = new Date(),
    yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  return date.toDateString() === today.toDateString()
    ? "Today"
    : date.toDateString() === yesterday.toDateString()
      ? "Yesterday"
      : date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}
export default function Activity() {
  const { top } = useSafeAreaInsets();
  const { session } = useSession();
  const [data, setData] = useState<{ wallet: string; events: ActivityEvent[]; next: string | null } | null>(
    null,
  );
  const [error, setError] = useState<"refresh" | "more" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<ActivityEvent | null>(null);
  const requestId = useRef(0);
  const paging = useRef(false);
  const loaded = data?.wallet === session?.walletAddress ? data : null;
  const load = useCallback(
    async (before?: string) => {
      if (!session) return;
      const current = ++requestId.current;
      setError(null);
      try {
        const page = await fetchActivity(session, before);
        if (current !== requestId.current) return;
        setData((previous) => ({
          wallet: session.walletAddress,
          next: page.next,
          events:
            before && previous?.wallet === session.walletAddress
              ? [
                  ...previous.events,
                  ...page.events.filter((e) => !previous.events.some((p) => p.id === e.id)),
                ]
              : page.events,
        }));
      } catch {
        if (current === requestId.current) setError(before ? "more" : "refresh");
      }
    },
    [session],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        requestId.current++;
      };
    }, [load]),
  );
  const groups = useMemo(() => {
    const result = new Map<string, ActivityEvent[]>();
    for (const event of loaded?.events ?? []) {
      if (
        (filter === "reviews" && !reviewKinds.has(event.kind)) ||
        (filter === "rewards" && !rewardKinds.has(event.kind))
      )
        continue;
      if (
        !`${event.title} ${eventLabels[event.kind] ?? ""} ${event.symbol}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      )
        continue;
      const day = dayLabel(event.at);
      result.set(day, [...(result.get(day) ?? []), event]);
    }
    return [...result.entries()];
  }, [loaded, filter, query]);
  const loadMore = async () => {
    if (!loaded?.next || paging.current || refreshing) return;
    paging.current = true;
    setMore(true);
    try {
      await load(loaded.next);
    } finally {
      paging.current = false;
      setMore(false);
    }
  };
  const reset = () => {
    setQuery("");
    setFilter("all");
    Keyboard.dismiss();
  };
  return (
    <View style={[s.screen, { paddingTop: top }]}>
      <BrowseHeading title="Activity" />
      <SearchBox value={query} onChange={setQuery} placeholder="Search your activity" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={[s.choices, { paddingVertical: 12, flexWrap: "nowrap" }]}
      >
        {[
          ["all", "All updates"],
          ["reviews", "Submissions"],
          ["rewards", "Rewards"],
        ].map(([key, label]) => (
          <Choice
            key={key}
            label={label}
            selected={filter === key}
            onPress={() => {
              Keyboard.dismiss();
              setFilter(key);
            }}
          />
        ))}
      </ScrollView>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              if (more) return;
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        {!loaded ? (
          <View style={s.center}>
            {error ? (
              <BrowseEmpty
                kind="activity"
                title="Couldn’t load your activity"
                message="Check your connection and try again."
                action={{ label: "Try again", onPress: () => void load() }}
              />
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </View>
        ) : !loaded.events.length ? (
          <BrowseEmpty
            kind="activity"
            title="No activity yet"
            message="Bounties, submissions and confirmed rewards will appear here."
            action={{ label: "Explore bounties", onPress: () => router.navigate("/(tabs)/explore") }}
          />
        ) : !groups.length ? (
          <BrowseEmpty
            kind="activity"
            title="No matching updates"
            message={
              loaded.next
                ? "Try another search, clear the filters, or load older updates below."
                : "Try another search or clear your filters."
            }
            action={{ label: "Clear search & filters", onPress: reset }}
          />
        ) : (
          groups.map(([day, events]) => (
            <View key={day}>
              <Text style={[s.section, { marginBottom: 12 }]}>{day}</Text>
              {events.map((event) => (
                <ActivityItem
                  key={event.id}
                  event={event}
                  onPress={() => {
                    Keyboard.dismiss();
                    setSelected(event);
                  }}
                />
              ))}
            </View>
          ))
        )}
        {loaded && error ? (
          <FlowNotice
            error
            title={error === "more" ? "Couldn’t load older updates" : "Couldn’t refresh"}
            message="Your loaded activity is still available."
            action={{ label: "Try again", onPress: () => void (error === "more" ? loadMore() : load()) }}
          />
        ) : null}
        {loaded?.next ? (
          <>
            <Text style={s.section}>Search and filters apply to loaded updates.</Text>
            <Button
              label="Load older updates"
              variant="secondary"
              loading={more}
              disabled={refreshing}
              onPress={() => void loadMore()}
            />
          </>
        ) : null}
      </ScrollView>
      {selected ? (
        <ActivityDetails
          event={selected}
          onClose={() => setSelected(null)}
          onOpen={() => {
            setSelected(null);
            router.push({
              pathname: reviewKinds.has(selected.kind) ? "/review/[id]" : "/bounty/[id]",
              params: { id: selected.bountyId },
            });
          }}
        />
      ) : null}
    </View>
  );
}
