import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { useSession } from "@/auth/session-context";
import { OnboardingScreen } from "@/components/ui/OnboardingScreen";
import { Button } from "@/components/ui/Button";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { onboardingSteps } from "@/onboarding/steps";
import { settingsStyle as s } from "@/settings/ui";
export default function Location() {
  const { profile } = useSession();
  const { granted, blocked, request } = useLocationPermission();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const allow = async () => {
    setBusy(true);
    setError(false);
    try {
      const p = await request();
      if (p?.granted) router.push("/tier");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <OnboardingScreen
      back={false}
      step={{ index: 0, count: onboardingSteps(Boolean(profile?.username)) }}
      title="Find bounties nearby"
      subtitle="Location helps you discover requests and confirm you’re at the spot."
      image={require("@/assets/images/onboarding-location.png")}
      footer={
        <>
          <Button
            label={granted ? "Continue" : blocked ? "Open settings" : "Allow location"}
            loading={busy}
            onPress={granted ? () => router.push("/tier") : () => void allow()}
          />
          {!granted && (
            <Button label="Not now" variant="text" disabled={busy} onPress={() => router.push("/tier")} />
          )}
        </>
      }
    >
      {error && <Text style={s.error}>Couldn’t request location. Try again.</Text>}
    </OnboardingScreen>
  );
}
