import { Camera, Map, type CameraRef, type LngLat } from "@maplibre/maplibre-react-native";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "@/theme";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
const EARTH_CIRCUMFERENCE_M = 40075016.686;
const TILE_SIZE = 512;
export const PLACE_ZOOM = 16;

export type Coordinate = { latitude: number; longitude: number };

export type LocationMapRef = { flyTo: (coordinate: Coordinate) => void };

type Props = {
  initial: Coordinate | null;
  radiusM: number;
  onMoveStart: () => void;
  onMoveEnd: (center: Coordinate) => void;
  ref?: Ref<LocationMapRef>;
};

const toLngLat = ({ latitude, longitude }: Coordinate): LngLat => [longitude, latitude];

/** Map with a fixed centre pin; the radius ring is drawn at true ground scale for the current zoom. */
export function LocationMap({ initial, radiusM, onMoveStart, onMoveEnd, ref }: Props) {
  const camera = useRef<CameraRef>(null);
  const [view, setView] = useState({ latitude: initial?.latitude ?? 20, zoom: initial ? PLACE_ZOOM : 1 });

  useImperativeHandle(ref, () => ({
    flyTo: (coordinate) => camera.current?.flyTo({ center: toLngLat(coordinate), zoom: PLACE_ZOOM, duration: 1200 }),
  }));

  const metersPerPoint =
    (EARTH_CIRCUMFERENCE_M * Math.cos((view.latitude * Math.PI) / 180)) / (TILE_SIZE * 2 ** view.zoom);
  const ring = Math.min((2 * radiusM) / metersPerPoint, 4000);

  return (
    <View style={styles.wrap}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE}
        logo={false}
        compass={false}
        touchPitch={false}
        touchRotate={false}
        attributionPosition={{ bottom: 8, left: 8 }}
        tintColor={colors.muted}
        onRegionWillChange={(event) => {
          if (event.nativeEvent.userInteraction) onMoveStart();
        }}
        onRegionIsChanging={(event) =>
          setView({ latitude: event.nativeEvent.center[1], zoom: event.nativeEvent.zoom })
        }
        onRegionDidChange={(event) => {
          const [longitude, latitude] = event.nativeEvent.center;
          setView({ latitude, zoom: event.nativeEvent.zoom });
          onMoveEnd({ latitude, longitude });
        }}
      >
        <Camera
          ref={camera}
          initialViewState={initial ? { center: toLngLat(initial), zoom: PLACE_ZOOM } : { center: [0, 20], zoom: 1 }}
        />
      </Map>
      <View pointerEvents="none" style={styles.overlay}>
        {ring >= 12 ? (
          <View style={[styles.ring, { width: ring, height: ring, borderRadius: ring / 2 }]} />
        ) : null}
        <View style={styles.pin}>
          <Svg width={36} height={46} viewBox="0 0 36 46" fill="none">
            <Path
              d="M18 45c0 0 16-15.2 16-27A16 16 0 0 0 2 18c0 11.8 16 27 16 27Z"
              fill={colors.primary}
              stroke={colors.background}
              strokeWidth={2}
            />
            <Circle cx={18} cy={18} r={6} fill={colors.onPrimary} />
          </Svg>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background, overflow: "hidden" },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "rgba(171, 159, 243, 0.16)",
  },
  pin: { position: "absolute", transform: [{ translateY: -22 }] },
});
