import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Keyboard, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BountyView } from "@/auth/api";
import { useSession } from "@/auth/session-context";
import { BrowseEmpty, BrowseHeading, Choice, SearchBox, browseStyles as s } from "@/components/ui/Browse";
import { BountyList, BountyRow } from "@/components/ui/BountyRow";
import { FlowNotice } from "@/components/ui/Flow";
import { useCurrentPosition } from "@/explore/use-current-position";
import { useNearbyBounties } from "@/explore/use-nearby-bounties";
import { ExploreFilters, defaultExploreOptions, type ExploreOptions } from "@/explore/ExploreFilters";
import { ExploreMap } from "@/explore/ExploreMap";
import { formatDistance, formatReward, formatTimeLeft } from "@/explore/format";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { TOKEN_META } from "@/post/options";
import { ModeSwitch } from "@/components/ui/ModeSwitch";
import { colors } from "@/theme";

const EMPTY_BOUNTIES: BountyView[] = [];

function matches(b: BountyView, q: string, f: ExploreOptions, now: number) {
  return (
    b.status === "open" &&
    Date.parse(b.expiresAt) > now &&
    (f.token === "all" || b.symbol === f.token) &&
    (b.taskMode === "remote" || f.radius === 25 || (b.distanceM !== null && b.distanceM <= f.radius * 1000)) &&
    `${b.title} ${b.instructions} ${b.locationLabel ?? "Online"}`.toLowerCase().includes(q.trim().toLowerCase())
  );
}
export default function Explore() {
  const { top } = useSafeAreaInsets();
  const { session } = useSession();
  const [mode, setMode] = useState<"remote" | "on_site">("remote");
  const local = mode === "on_site";
  const location = useLocationPermission();
  const position = useCurrentPosition(local && location.granted);
  const from = local && position.state.status === "ready" ? position.state.coords : null;
  const nearby = useNearbyBounties(session, from, mode);
  const [mapView, setMapView] = useState(false);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(defaultExploreOptions);
  const [draft, setDraft] = useState<ExploreOptions | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [permissionError, setPermissionError] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const bounties = nearby.state.status === "ready" ? nearby.state.bounties : EMPTY_BOUNTIES;
  const results = useMemo(
    () =>
      bounties
        .filter((b) => matches(b, query, filters, now))
        .sort((a, b) =>
          filters.sort === "ending"
            ? Date.parse(a.expiresAt) - Date.parse(b.expiresAt)
            : filters.sort === "reward"
              ? Number(b.amount) / 10 ** b.decimals - Number(a.amount) / 10 ** a.decimals
              : (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity),
        ),
    [bounties, query, filters, now],
  );
  const active = filters.token !== "all" || filters.radius !== 25 || filters.sort !== "nearest";
  const reset = () => {
    setQuery("");
    setFilters(defaultExploreOptions);
    Keyboard.dismiss();
  };
  const refresh = async () => {
    setRefreshing(true);
    try {
      const coords = local ? await position.locate() : null;
      if (!local || coords) await nearby.load(coords);
    } finally {
      setRefreshing(false);
    }
  };
  const requestLocation = async () => {
    setPermissionError(false);
    try {
      await location.request();
    } catch {
      setPermissionError(true);
    }
  };
  let body;
  if (local && location.error && !location.permission)
    body = (
      <BrowseEmpty
        kind="location"
        title="Couldn’t check location access"
        message="Try again to find nearby bounties."
        action={{ label: "Try again", onPress: () => void location.refresh() }}
      />
    );
  else if (
    (!local && nearby.state.status === "loading") ||
    (local && (!location.permission || (location.granted && (position.state.status === "locating" || nearby.state.status === "loading"))))
  )
    body = (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[s.section, { marginTop: 14 }]}>Loading bounties…</Text>
      </View>
    );
  else if (local && !location.granted)
    body = (
      <BrowseEmpty
        kind="location"
        title="Find nearby bounties"
        message={
          permissionError
            ? "Couldn’t open location access. Try again."
            : "Allow location to discover nearby bounties. Exact target details are revealed after acceptance."
        }
        action={{
          label: location.blocked ? "Open settings" : "Enable location",
          onPress: () => void requestLocation(),
        }}
      />
    );
  else if ((local && position.state.status === "error") || nearby.state.status === "error")
    body = (
      <BrowseEmpty
        kind="location"
        title={local && position.state.status === "error" ? "Let’s find your location" : "Couldn’t load bounties"}
        message={local ? "Check your connection and location access, then try again." : "Check your connection, then try again."}
        action={{
          label: "Try again",
          onPress: local && position.state.status === "error" ? position.retry : nearby.retry,
        }}
      />
    );
  else
    body = (
      <>
        <Text style={s.section}>
          {results.length} {results.length === 1 ? "bounty" : "bounties"} · {local ? `Within ${filters.radius} km` : "Online"}
          {bounties.length >= 50 ? " · 50 loaded" : ""}
        </Text>
        {nearby.state.status === "ready" && nearby.state.stale ? (
          <FlowNotice
            error
            title="Couldn’t refresh"
            message="Showing your last loaded results."
            action={{ label: "Try again", onPress: () => void refresh() }}
          />
        ) : null}
        {results.length ? (
          <BountyList>
            {results.map((b) => (
              <BountyRow
                key={b.id}
                icon={TOKEN_META[b.symbol].icon}
                title={b.title}
                subtitle={[
                  b.mine ? "Your bounty" : null,
                  b.distanceM !== null ? formatDistance(b.distanceM) : null,
                  b.locationLabel ?? "Online",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                reward={formatReward(b)}
                timeLeft={formatTimeLeft(b.expiresAt, now)}
                onPress={() => {
                  Keyboard.dismiss();
                  router.push({ pathname: "/bounty/[id]", params: { id: b.id } });
                }}
              />
            ))}
          </BountyList>
        ) : (
          <BrowseEmpty
            title={query || active ? "No matching bounties" : local ? "Nothing nearby yet" : "No online bounties yet"}
            message={
              query || active
                ? "Try another search or widen your filters."
                : local ? "No open bounties within 25 km. Check back later or post one." : "Post a task for someone to complete from anywhere."
            }
            action={{
              label: query || active ? "Clear search & filters" : "Post a bounty",
              onPress: query || active ? reset : () => router.push("/post"),
            }}
          />
        )}
      </>
    );
  return (
    <View style={[s.screen, { paddingTop: top }]}>
      <BrowseHeading title="Explore" action={{ label: "Post", onPress: () => router.push("/post") }} />
      <SearchBox value={query} onChange={setQuery} placeholder="Search bounties" />
      <View style={{ marginHorizontal: 20, marginTop: 16 }}><ModeSwitch value={mode} options={[{ value: "remote", label: "Online" }, { value: "on_site", label: "Nearby" }]} onChange={(next) => { Keyboard.dismiss(); setMode(next); if (next === "remote") setMapView(false); }} /></View>
      <View style={[s.choices, { paddingVertical: 8, justifyContent: "flex-end" }]}>
        <Choice
          label={active ? "Filters · On" : "Filters & sort"}
          selected={active}
          onPress={() => {
            Keyboard.dismiss();
            setDraft({ ...filters });
          }}
        />
        {local ? <Choice
          label={mapView ? "List view" : "Map view"}
          selected={mapView}
          onPress={() => {
            Keyboard.dismiss();
            setMapView(!mapView);
          }}
        /> : null}
      </View>
      {mapView && from && nearby.state.status === "ready" ? (
        <ExploreMap bounties={results} from={from} now={now} />
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            !local || location.granted ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void refresh()}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      )}
      {draft ? (
        <ExploreFilters
          value={draft}
          local={local}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          count={bounties.filter((b) => matches(b, query, draft, now)).length}
          onApply={() => {
            setFilters(draft);
            setDraft(null);
          }}
        />
      ) : null}
    </View>
  );
}
