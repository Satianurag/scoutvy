import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { LocationMap, type Coordinate, type LocationMapRef } from "@/components/ui/LocationMap";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { useDraft, type BountyPlace } from "@/post/draft";
import { describePlace } from "@/post/places";
import { RADIUS_OPTIONS_M, formatRadius } from "@/post/options";
import { colors, fonts, layout } from "@/theme";
import { PostHeader, usePostStep } from "@/post/ui";

type Search =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "error" }
  | { status: "done"; results: BountyPlace[] };

export default function PostLocation() {
  const { draft, update } = useDraft();
  const { editing, advance } = usePostStep("/post/token");
  const [locationError, setLocationError] = useState<string | null>(null);
  const map = useRef<LocationMapRef>(null);
  const permission = useLocationPermission();
  const [initial, setInitial] = useState<Coordinate | null | undefined>(draft.place ?? undefined);
  const [place, setPlace] = useState<BountyPlace | null>(draft.place);
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ status: "idle" });
  const lookup = useRef(0);
  const searchRequest = useRef(0);

  useEffect(() => {
    if (initial !== undefined) return;
    Location.getForegroundPermissionsAsync()
      .then((status) => (status.granted ? Location.getLastKnownPositionAsync() : null))
      .then((position) => setInitial(position ? position.coords : null))
      .catch(() => setInitial(null));
  }, [initial]);

  const settle = async (center: Coordinate) => {
    setMoving(true);
    const request = ++lookup.current;
    const label = await describePlace(center);
    if (request === lookup.current) {
      setPlace({ ...center, label });
      setMoving(false);
    }
  };

  const locate = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const result = permission.granted ? permission.permission : await permission.request();
      if (!result?.granted) {
        setLocationError("Allow location access, or search for an address instead.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setMoving(true);
      map.current?.flyTo(position.coords);
    } catch {
      setLocationError("Couldn’t find your location. Try again or search an address.");
    } finally {
      setLocating(false);
    }
  };

  const runSearch = async () => {
    const text = query.trim();
    if (!text) return;
    Keyboard.dismiss();
    const request = ++searchRequest.current;
    setSearch({ status: "searching" });
    try {
      const found = (await Location.geocodeAsync(text)).slice(0, 4);
      const results = await Promise.all(
        found.map(async ({ latitude, longitude }) => ({
          latitude,
          longitude,
          label: await describePlace({ latitude, longitude }),
        })),
      );
      if (request === searchRequest.current) setSearch({ status: "done", results });
    } catch {
      if (request === searchRequest.current) setSearch({ status: "error" });
    }
  };

  const choose = (result: BountyPlace) => {
    setSearch({ status: "idle" });
    setQuery("");
    setMoving(true);
    map.current?.flyTo(result);
  };

  return (
    <Screen>
      <PostHeader step={2} title="Pin the spot" />
      <View style={styles.search}>
        <TextField
          value={query}
          onChangeText={(value) => {
            searchRequest.current++;
            setQuery(value);
            setSearch({ status: "idle" });
          }}
          onSubmit={() => void runSearch()}
          prefix={
            <View style={styles.searchIcon}>
              <Icon
                name={{ ios: "magnifyingglass", android: "search", web: "search" }}
                size={19}
                color={colors.textSecondary}
              />
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
            onMoveStart={() => {
              lookup.current++;
              setMoving(true);
            }}
            onMoveEnd={(center) => void settle(center)}
          />
        )}
        {search.status !== "idle" ? (
          <Animated.View
            entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(140).reduceMotion(ReduceMotion.System)}
            style={styles.results}
          >
            {search.status === "searching" ? (
              <View style={styles.resultsMessage}>
                <ActivityIndicator color={colors.muted} />
              </View>
            ) : search.status === "error" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void runSearch()}
                style={styles.resultsMessage}
              >
                <Text style={styles.resultsText}>Search unavailable. Tap to try again.</Text>
              </Pressable>
            ) : search.results.length === 0 ? (
              <View style={styles.resultsMessage}>
                <Text style={styles.resultsText}>No places found. Try a fuller address.</Text>
              </View>
            ) : (
              <View style={styles.resultList}>
                {search.results.map((result) => (
                  <Pressable
                    key={`${result.latitude},${result.longitude}`}
                    accessibilityRole="button"
                    onPress={() => choose(result)}
                    style={styles.resultRow}
                  >
                    <Text style={styles.resultsText}>{result.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Animated.View>
        ) : null}
        <Pressable
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          onPress={() => void locate()}
          style={({ pressed }) => [styles.locate, pressed && styles.locatePressed]}
        >
          {locating ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Icon
              name={{ ios: "location.fill", android: "my_location", web: "my_location" }}
              size={22}
              color={colors.text}
            />
          )}
        </Pressable>
      </View>
      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheet}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Text style={styles.eyebrow}>PROOF LOCATION</Text>
        <Text numberOfLines={2} style={styles.place}>
          {initial === null && !place
            ? "Search or move the map to the spot"
            : moving || !place
              ? "Finding place…"
              : place.label}
        </Text>
        {locationError ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {locationError}
          </Text>
        ) : null}
        <Text style={styles.hint}>Move the map to adjust the pin. Capture radius:</Text>
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
          label={editing ? "Save location" : "Use this location"}
          style={{ height: 52, marginHorizontal: 20, borderRadius: 16 }}
          disabled={moving || !place}
          containerStyle={styles.confirm}
          onPress={() => {
            if (!place) return;
            update({ place });
            advance();
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { paddingBottom: 12 },
  searchIcon: { width: 28 },
  mapArea: { flex: 1, minHeight: 150, marginHorizontal: 20, borderRadius: 24, overflow: "hidden" },
  mapLoading: { flex: 1, alignItems: "center", justifyContent: "center" },
  results: { position: "absolute", top: 0, left: 0, right: 0 },
  resultList: { backgroundColor: colors.surface, borderRadius: 16, margin: 8, overflow: "hidden" },
  resultRow: {
    padding: 16,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceRaised,
  },
  resultsMessage: {
    marginHorizontal: 20,
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
  sheet: { paddingTop: 22, paddingBottom: layout.bottomGap },
  eyebrow: {
    marginHorizontal: 20,
    marginBottom: 10,
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.primary,
  },
  error: {
    marginHorizontal: 20,
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.orange,
  },
  place: {
    marginHorizontal: 20,
    minHeight: 44,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
  },
  hint: {
    marginTop: 10,
    marginHorizontal: 20,
    fontFamily: fonts.regular,
    fontSize: 14.9,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  chips: { marginTop: 10, marginHorizontal: 20, flexDirection: "row", gap: 8 },
  confirm: { marginTop: 20 },
});
