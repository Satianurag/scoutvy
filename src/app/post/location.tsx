import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { LocationMap, type Coordinate, type LocationMapRef } from "@/components/ui/LocationMap";
import { NavBar } from "@/components/ui/NavBar";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { useDraft, type BountyPlace } from "@/post/draft";
import { describePlace } from "@/post/places";
import { RADIUS_OPTIONS_M, formatRadius } from "@/post/options";
import { colors, fonts, layout } from "@/theme";

type Search = { status: "idle" } | { status: "searching" } | { status: "done"; results: BountyPlace[] };

export default function PostLocation() {
  const { draft, update } = useDraft();
  const map = useRef<LocationMapRef>(null);
  const permission = useLocationPermission();
  const [initial, setInitial] = useState<Coordinate | null | undefined>(draft.place ?? undefined);
  const [place, setPlace] = useState<BountyPlace | null>(draft.place);
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ status: "idle" });
  const lookup = useRef(0);

  useEffect(() => {
    if (initial !== undefined) return;
    Location.getForegroundPermissionsAsync()
      .then((status) => (status.granted ? Location.getLastKnownPositionAsync() : null))
      .then((position) => setInitial(position ? position.coords : null))
      .catch(() => setInitial(null));
  }, [initial]);

  const settle = async (center: Coordinate) => {
    setMoving(false);
    const request = ++lookup.current;
    const label = await describePlace(center);
    if (request === lookup.current) setPlace({ ...center, label });
  };

  const locate = async () => {
    const result = permission.granted ? permission.permission : await permission.request();
    if (!result?.granted) return;
    setLocating(true);
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      map.current?.flyTo(position.coords);
    } finally {
      setLocating(false);
    }
  };

  const runSearch = async () => {
    const text = query.trim();
    if (!text) return;
    Keyboard.dismiss();
    setSearch({ status: "searching" });
    try {
      const found = (await Location.geocodeAsync(text)).slice(0, 4);
      const results = await Promise.all(
        found.map(async ({ latitude, longitude }) => ({ latitude, longitude, label: await describePlace({ latitude, longitude }) })),
      );
      setSearch({ status: "done", results });
    } catch {
      setSearch({ status: "done", results: [] });
    }
  };

  const choose = (result: BountyPlace) => {
    setSearch({ status: "idle" });
    setQuery("");
    map.current?.flyTo(result);
  };

  return (
    <Screen>
      <NavBar title="Location" />
      <View style={styles.search}>
        <TextField
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            if (!value) setSearch({ status: "idle" });
          }}
          onSubmit={() => void runSearch()}
          prefix={
            <View style={styles.searchIcon}>
              <Icon name={{ ios: "magnifyingglass", android: "search", web: "search" }} size={19} color={colors.textSecondary} />
            </View>
          }
          clearable
          returnKeyType="search"
          autoCapitalize="words"
          autoCorrect={false}
          placeholder="Search a place or address"
          accessibilityLabel="Search places"
        />
      </View>
      <View style={styles.mapArea}>
        {initial === undefined ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={colors.muted} />
          </View>
        ) : (
          <LocationMap
            ref={map}
            initial={initial}
            radiusM={draft.radiusM}
            onMoveStart={() => setMoving(true)}
            onMoveEnd={(center) => void settle(center)}
          />
        )}
        {search.status !== "idle" ? (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.results}>
            {search.status === "searching" ? (
              <View style={styles.resultsMessage}>
                <ActivityIndicator color={colors.muted} />
              </View>
            ) : search.results.length === 0 ? (
              <View style={styles.resultsMessage}>
                <Text style={styles.resultsText}>No places found. Try a fuller address.</Text>
              </View>
            ) : (
              <ListGroup>
                {search.results.map((result) => (
                  <ListRow key={`${result.latitude},${result.longitude}`} label={result.label} onPress={() => choose(result)} />
                ))}
              </ListGroup>
            )}
          </Animated.View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          onPress={() => void locate()}
          style={({ pressed }) => [styles.locate, pressed && styles.locatePressed]}
        >
          {locating ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Icon name={{ ios: "location.fill", android: "my_location", web: "my_location" }} size={22} color={colors.text} />
          )}
        </Pressable>
      </View>
      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled" bounces={false}>
        <Text numberOfLines={2} style={styles.place}>
          {initial === null && !place ? "Search or move the map to the spot" : moving || !place ? "Finding place…" : place.label}
        </Text>
        <Text style={styles.hint}>Scouts must capture proof within</Text>
        <View style={styles.chips}>
          {RADIUS_OPTIONS_M.map((radius) => (
            <Chip
              key={radius}
              label={formatRadius(radius)}
              selected={draft.radiusM === radius}
              onPress={() => update({ radiusM: radius })}
            />
          ))}
        </View>
        <Button
          label="Confirm Location"
          disabled={moving || !place}
          containerStyle={styles.confirm}
          onPress={() => {
            if (!place) return;
            update({ place });
            router.push("/post/token");
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { paddingBottom: 12 },
  searchIcon: { width: 28 },
  mapArea: { flex: 1, minHeight: 150 },
  mapLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  results: { position: "absolute", top: 0, left: 0, right: 0 },
  resultsMessage: {
    marginHorizontal: 16,
    height: layout.rowHeight,
    borderRadius: layout.groupRadius,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsText: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary },
  locate: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  locatePressed: { backgroundColor: colors.surfaceRaised },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheet: { paddingTop: 18, paddingBottom: layout.bottomGap },
  place: {
    marginHorizontal: 16,
    minHeight: 44,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
  },
  hint: {
    marginTop: 10,
    marginHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 14.9,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  chips: { marginTop: 10, marginHorizontal: 16, flexDirection: "row", gap: 8 },
  confirm: { marginTop: 20 },
});
