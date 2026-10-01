import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Linking, StyleSheet } from "react-native";

import { useSession } from "@/auth/session-context";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Illustration } from "@/components/ui/Illustration";
import { NavBar } from "@/components/ui/NavBar";
import { Screen } from "@/components/ui/Screen";
import { Toggle } from "@/components/ui/Toggle";
import { Subtitle, Title } from "@/components/ui/Typography";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { onboardingSteps } from "@/onboarding/steps";

export default function LocationStep() {
  const { profile } = useSession();
  const { granted, blocked, request } = useLocationPermission();

  const toggle = async (next: boolean) => {
    if (!next) {
      await Linking.openSettings();
      return;
    }
    const result = await request();
    if (result?.granted) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <Screen>
      <NavBar back={false} step={{ index: 0, count: onboardingSteps(Boolean(profile?.username)) }} />
      <Illustration source={require("@/assets/images/onboarding-location.png")} width={175} height={153} top={23.8} />
      <Title style={styles.title}>Enable Location</Title>
      <Subtitle style={styles.subtitle}>
        Scoutvy uses your location to show bounties near you and to confirm you&apos;re at the spot when you capture
        proof.
      </Subtitle>
      <Card
        icon={<Icon name={{ ios: "location", android: "near_me", web: "near_me" }} size={24} />}
        title="Location"
        subtitle={blocked ? "Turn it on in Settings" : "Only used while you scout"}
        accessory={<Toggle value={granted} onChange={toggle} label="Location access" />}
      />
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
