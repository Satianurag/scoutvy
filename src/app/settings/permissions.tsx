import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, Linking, Text } from "react-native";
import { Camera } from "expo-camera";
import * as Location from "expo-location";
import { SettingsScreen, SettingsGroup, settingsStyle as s } from "@/settings/ui";
import { ListRow } from "@/components/ui/ListRow";
import { useAppDialog } from "@/components/ui/AppDialog";
export default function Permissions() {
  const [location, setLocation] = useState("Checking…");
  const [camera, setCamera] = useState("Checking…");
  const dialog = useAppDialog();
  const refresh = useCallback(() => {
    void Location.getForegroundPermissionsAsync()
      .then((p) => setLocation(p.granted ? "Allowed" : "Not allowed"))
      .catch(() => setLocation("Unavailable"));
    void Camera.getCameraPermissionsAsync()
      .then((p) => setCamera(p.granted ? "Allowed" : "Not allowed"))
      .catch(() => setCamera("Unavailable"));
  }, []);
  useFocusEffect(
    useCallback(() => {
      refresh();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => subscription.remove();
    }, [refresh]),
  );
  const open = () =>
    void Linking.openSettings().catch(() =>
      dialog({
        title: "Couldn’t open settings",
        message: "Open Scoutvy’s permissions in your phone settings.",
        tone: "info",
      }),
    );
  return (
    <SettingsScreen title="Permissions">
      <SettingsGroup>
        <ListRow label="Location" value={location} onPress={open} />
        <ListRow label="Camera" value={camera} onPress={open} />
      </SettingsGroup>
      <Text style={s.body}>
        Location is used for local bounties. Camera access is needed only for photo proof.
      </Text>
    </SettingsScreen>
  );
}
