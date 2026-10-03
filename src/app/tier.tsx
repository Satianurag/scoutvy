import { router } from "expo-router";
import { useSession } from "@/auth/session-context";
import { OnboardingScreen } from "@/components/ui/OnboardingScreen";
import { Button } from "@/components/ui/Button";
import { SettingsGroup } from "@/settings/ui";
import { ListRow } from "@/components/ui/ListRow";
import { onboardingSteps } from "@/onboarding/steps";
export default function Tier() {
  const { tier, refreshTier, session, profile } = useSession();
  const verified = tier.status === "ready" && tier.tier.tier === "verified_seeker";
  const ready = tier.status === "ready";
  return (
    <OnboardingScreen
      step={{ index: 1, count: onboardingSteps(Boolean(profile?.username)) }}
      title={
        verified
          ? "SGT verified"
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
            : "Checking SGT ownership on Solana Mainnet."
      }
      image={
        verified
          ? require("@/assets/images/onboarding-seeker.png")
          : require("@/assets/images/onboarding-scout.png")
      }
      footer={
        <Button
          label={tier.status === "error" ? "Try again" : "Continue"}
          loading={tier.status === "loading"}
          onPress={
            tier.status === "error"
              ? () => void refreshTier()
              : () =>
                  router.push(
                    profile?.username ? { pathname: "/ready", params: { returning: "1" } } : "/username",
                  )
          }
        />
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
