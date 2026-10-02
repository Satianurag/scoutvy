import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import type { Coordinates } from "@/auth/api";

const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

export type PositionState = { status: "locating" } | { status: "ready"; coords: Coordinates } | { status: "error" };

/** The device position, available once foreground location permission is granted. */
export function useCurrentPosition(granted: boolean) {
  const [state, setState] = useState<PositionState>({ status: "locating" });
  const latest = useRef(0);

  const locate = useCallback(async () => {
    const request = ++latest.current;
    try {
      const recent = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
      const position =
        recent ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() =>
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        ));
      const { latitude, longitude } = position.coords;
      if (request === latest.current) setState({ status: "ready", coords: { latitude, longitude } });
    } catch {
      if (request === latest.current) setState((current) => (current.status === "ready" ? current : { status: "error" }));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (granted) void locate();
    }, [granted, locate]),
  );

  const retry = useCallback(() => {
    setState({ status: "locating" });
    void locate();
  }, [locate]);

  return { state, locate, retry };
}
