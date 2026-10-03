import { Map, type MapProps, type StyleSpecification } from "@maplibre/maplibre-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
let sharedStyle: Promise<StyleSpecification> | undefined;
function loadStyle() {
  if (!sharedStyle)
    sharedStyle = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(STYLE_URL, { signal: controller.signal });
        if (!response.ok) throw new Error("map_unavailable");
        const style: StyleSpecification = await response.json();
        // Only paint changes. Sources, coordinates, attribution and live tiles stay with OpenFreeMap.
        return {
          ...style,
          layers: style.layers.map((layer) => {
            if (layer.type === "background")
              return { ...layer, paint: { ...layer.paint, "background-color": colors.background } };
            if (layer.type === "symbol" && layer.layout?.["text-field"])
              return {
                ...layer,
                paint: {
                  ...layer.paint,
                  "text-color": colors.textSecondary,
                  "text-halo-color": colors.background,
                  "text-halo-width": 1,
                },
              };
            if (layer.type === "fill" && layer.id === "water")
              return { ...layer, paint: { ...layer.paint, "fill-color": "#242130" } };
            if (layer.type === "line" && layer.id.startsWith("highway") && !layer.id.includes("casing"))
              return { ...layer, paint: { ...layer.paint, "line-color": colors.border } };
            return layer;
          }),
        } as StyleSpecification;
      } finally {
        clearTimeout(timeout);
      }
    })().catch((error) => {
      sharedStyle = undefined;
      throw error;
    });
  return sharedStyle;
}
export function LiveMap({ style, children, ...props }: Omit<MapProps, "mapStyle">) {
  const [mapStyle, setMapStyle] = useState<StyleSpecification>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void loadStyle()
      .then((value) => {
        if (active) setMapStyle(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    if (loaded || error) return;
    const timer = setTimeout(() => setError(true), 15000);
    return () => clearTimeout(timer);
  }, [loaded, error, revision]);
  return (
    <View style={style}>
      {mapStyle && (
        <Map
          {...props}
          key={revision}
          style={StyleSheet.absoluteFill}
          mapStyle={mapStyle}
          onDidFinishRenderingMapFully={(event) => {
            setLoaded(true);
            setError(false);
            props.onDidFinishRenderingMapFully?.(event);
          }}
          onDidFailLoadingMap={(event) => {
            setError(true);
            props.onDidFailLoadingMap?.(event);
          }}
        >
          {children}
        </Map>
      )}
      {(!loaded || error) && (
        <View pointerEvents={error ? "auto" : "none"} style={s.overlay}>
          {error ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLoaded(false);
                setError(false);
                setRevision((n) => n + 1);
              }}
              style={s.retry}
            >
              <Text style={s.title}>Couldn’t load the map</Text>
              <Text style={s.copy}>Tap to retry</Text>
            </Pressable>
          ) : (
            <View style={s.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.copy}>Loading map…</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  loading: { backgroundColor: colors.surface, padding: 18, borderRadius: 20, gap: 12, alignItems: "center" },
  retry: { backgroundColor: colors.surface, padding: 20, borderRadius: 20, gap: 8, alignItems: "center" },
  title: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  copy: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
});
