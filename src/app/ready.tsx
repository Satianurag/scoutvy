import { useState } from "react";
import { Text } from "react-native";
import { useSession } from "@/auth/session-context";
import { OnboardingScreen } from "@/components/ui/OnboardingScreen";
import { Button } from "@/components/ui/Button";
import { settingsStyle as s } from "@/settings/ui";
export default function Ready() {
  const { finishOnboarding } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <OnboardingScreen
      back={false}
      title="You’re ready."
      subtitle="Find a bounty or post your own."
      image={require("@/assets/images/onboarding-scout.png")}
      footer={
        <Button
          label="Explore bounties"
          loading={busy}
          onPress={() => {
            setBusy(true);
            void finishOnboarding().catch(() => {
              setBusy(false);
              setError(true);
            });
          }}
        />
      }
    >
      {error && <Text style={s.error}>Couldn’t finish setup. Try again.</Text>}
    </OnboardingScreen>
  );
}
