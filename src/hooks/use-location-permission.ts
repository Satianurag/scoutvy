import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";

export function useLocationPermission() {
  const [permission, setPermission] = useState<Location.LocationPermissionResponse | null>(null);
  const [error, setError] = useState(false);
  const latest = useRef(0);

  const refresh = useCallback(() => {
    const requestId = ++latest.current;
    return Location.getForegroundPermissionsAsync()
      .then((result) => {
        if (requestId === latest.current) {
          setPermission(result);
          setError(false);
        }
      })
      .catch(() => {
        if (requestId === latest.current) setError(true);
      });
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const granted = permission?.granted ?? false;
  const blocked = permission !== null && !permission.granted && !permission.canAskAgain;

  const request = useCallback(async () => {
    if (blocked) {
      await Linking.openSettings();
      return null;
    }
    const result = await Location.requestForegroundPermissionsAsync();
    latest.current++;
    setPermission(result);
    setError(false);
    return result;
  }, [blocked]);

  return { permission, granted, blocked, request, error, refresh };
}
