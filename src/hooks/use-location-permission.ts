import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking } from "react-native";

export function useLocationPermission() {
  const [permission, setPermission] = useState<Location.LocationPermissionResponse | null>(null);

  const refresh = useCallback(() => {
    Location.getForegroundPermissionsAsync().then(setPermission);
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
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
    setPermission(result);
    return result;
  }, [blocked]);

  return { permission, granted, blocked, request };
}
