import { router } from "expo-router";
import { useSession } from "@/auth/session-context";
import { OnboardingScreen } from "@/components/ui/OnboardingScreen";
import { Button } from "@/components/ui/Button";
import { SettingsGroup } from "@/settings/ui";
import { ListRow } from "@/components/ui/ListRow";
export default function Tier() {
  const { tier, refreshTier, session, profile } = useSession();
  const verified = tier.status === "ready" && tier.tier.tier === "verified_seeker";
  const ready = tier.status === "ready";
  return (
    <OnboardingScreen
      title={
        verified
          ? "Seeker verified"
          : ready
            ? "You’re a Scout"
            : tier.status === "error"
              ? "Couldn’t check wallet"
              : "Checking your wallet…"
      }
      subtitle={
        verified
          ? "A Seeker Genesis Token is linked to this wallet."
          : ready
            ? tier.tier.tier === "unverified" && tier.tier.reason === "sgt_claimed_by_another_wallet"
              ? "This SGT is already linked to another wallet."
              : "You can browse and take bounties with this wallet."
            : tier.status === "error"
              ? "You can continue and check again from your profile."
              : "Checking for a Seeker Genesis Token."
      }
      image={
        verified
          ? require("@/assets/images/onboarding-seeker.png")
          : require("@/assets/images/onboarding-scout.png")
      }
      footer={
        <>
          <Button label="Continue" onPress={() => router.push(profile?.username ? "/ready" : "/username")} />
          {tier.status === "error" && <Button label="Check again" variant="text" onPress={() => void refreshTier()} />}
        </>
      }
    >
      <SettingsGroup>
        <ListRow
          label="Wallet"
          value={session ? `${session.walletAddress.slice(0, 4)}…${session.walletAddress.slice(-4)}` : ""}
        />
      </SettingsGroup>
    </OnboardingScreen>
  );
}
