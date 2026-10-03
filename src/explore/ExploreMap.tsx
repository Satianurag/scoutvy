import { Camera, Marker, type CameraRef } from "@maplibre/maplibre-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import type { BountyView, Coordinates } from "@/auth/api";
import { LiveMap } from "@/components/ui/LiveMap";
import { BountyRow } from "@/components/ui/BountyRow";
import { Icon } from "@/components/ui/Icon";
import { formatReward, formatTimeLeft } from "@/explore/format";
import { TOKEN_META } from "@/post/options";
import { colors, fonts } from "@/theme";
export function ExploreMap({
  bounties,
  from,
  now,
}: {
  bounties: BountyView[];
  from: Coordinates;
  now: number;
}) {
  const camera = useRef<CameraRef>(null);
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const groups = useMemo(() => {
    const rows = new globalThis.Map<string, BountyView[]>();
    for (const bounty of bounties)
      if (bounty.area) {
        const key = `${bounty.area.longitude},${bounty.area.latitude}`;
        rows.set(key, [...(rows.get(key) ?? []), bounty]);
      }
    return [...rows].map(([key, items]) => ({ key, items, area: items[0].area! }));
  }, [bounties]);
  const selection = groups.find((g) => g.key === selected);
  return (
    <View style={s.wrap}>
      <LiveMap
        style={StyleSheet.absoluteFill}
        logo={false}
        compass={false}
        touchPitch={false}
        touchRotate={false}
        attributionPosition={{ top: 8, left: 8 }}
        tintColor={colors.textSecondary}
      >
        <Camera ref={camera} initialViewState={{ center: [from.longitude, from.latitude], zoom: 10 }} />
        {groups.map((group) => (
          <Marker
            key={group.key}
            id={group.key}
            lngLat={[group.area.longitude, group.area.latitude]}
            onPress={() => setSelected(group.key)}
          >
            <View style={[s.pin, selected === group.key && s.selected]}>
              <Text style={[s.pinText, selected === group.key && { color: colors.onPrimary }]}>
                {group.items.length > 1 ? `${group.items.length} bounties` : formatReward(group.items[0])}
              </Text>
            </View>
          </Marker>
        ))}
      </LiveMap>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Center map on my location"
        style={s.locate}
        onPress={() =>
          camera.current?.flyTo({
            center: [from.longitude, from.latitude],
            zoom: 10,
            duration: reduced ? 0 : 400,
          })
        }
      >
        <Icon name={{ ios: "location", android: "my_location", web: "my_location" }} size={22} />
      </Pressable>
      <View style={s.bottom}>
        {!selection ? (
          <View pointerEvents="none" style={s.notice}>
            <Text style={s.copy}>
              {groups.length ? "Pins show approximate areas" : "No bounties in these results"}
            </Text>
          </View>
        ) : null}
        {selection ? (
          <View style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.caption}>Approximate area</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close selected area"
                style={s.close}
                onPress={() => setSelected(null)}
              >
                <Icon name={{ ios: "xmark", android: "close", web: "close" }} size={20} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 200 }}>
              {selection.items.map((b) => (
                <BountyRow
                  key={b.id}
                  icon={TOKEN_META[b.symbol].icon}
                  title={b.title}
                  subtitle={b.locationLabel}
                  reward={formatReward(b)}
                  timeLeft={formatTimeLeft(b.expiresAt, now)}
                  onPress={() => router.push({ pathname: "/bounty/[id]", params: { id: b.id } })}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  pin: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pinText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.text },
  locate: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: { position: "absolute", left: 12, right: 12, bottom: 12, gap: 8 },
  notice: {
    alignSelf: "center",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  copy: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, textAlign: "center" },
  card: { borderRadius: 20, overflow: "hidden", backgroundColor: colors.surface },
  cardHead: { paddingLeft: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  caption: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
