import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, StyleSheet } from "react-native";

import { useSession } from "@/auth/session-context";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Illustration } from "@/components/ui/Illustration";
import { NavBar } from "@/components/ui/NavBar";
import { Reveal } from "@/components/ui/Reveal";
import { Screen } from "@/components/ui/Screen";
import { Toggle } from "@/components/ui/Toggle";
import { Subtitle, Title } from "@/components/ui/Typography";
import { onboardingSteps } from "@/onboarding/steps";

export default function LocationStep() {
  const { profile } = useSession();
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

  const toggle = async (next: boolean) => {
    if (!next || blocked) {
      await Linking.openSettings();
      return;
    }
    const result = await Location.requestForegroundPermissionsAsync();
    setPermission(result);
    if (result.granted) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <Screen>
      <NavBar back={false} step={{ index: 0, count: onboardingSteps(Boolean(profile?.username)) }} />
      <Reveal>
        <Illustration source={require("@/assets/images/onboarding-location.png")} width={175} height={153} top={23.8} />
      </Reveal>
      <Reveal order={1}>
        <Title style={styles.title}>Enable Location</Title>
        <Subtitle style={styles.subtitle}>
          Scoutvy uses your location to show bounties near you and to confirm you&apos;re at the spot when you capture proof.
        </Subtitle>
      </Reveal>
      <Reveal order={2}>
        <Card
          icon={<Icon name={{ ios: "location", android: "near_me", web: "near_me" }} size={24} />}
          title="Location"
          subtitle={blocked ? "Turn it on in Settings" : "Only used while you scout"}
          accessory={<Toggle value={granted} onChange={toggle} label="Location access" />}
        />
      </Reveal>
      <BottomActions>
        <Button label="Next" onPress={() => router.push("/tier")} />
      </BottomActions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 24 },
  subtitle: { marginTop: 13, marginBottom: 33 },
});
