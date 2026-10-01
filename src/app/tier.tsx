import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useSession, type TierState } from "@/auth/session-context";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Illustration } from "@/components/ui/Illustration";
import { NavBar } from "@/components/ui/NavBar";
import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";
import { ONBOARDING_STEPS } from "@/onboarding/steps";
import { colors } from "@/theme";

function copy(tier: TierState) {
  if (tier.status === "loading") {
    return { title: "Checking Your Wallet", body: "Looking for a Seeker Genesis Token on Solana mainnet." };
  }
  if (tier.status === "error") {
    return { title: "Couldn't Check Your Tier", body: "Scoutvy couldn't reach Solana right now. Try again in a moment." };
  }
  if (tier.tier.tier === "verified_seeker") {
    return { title: "You're a Verified Seeker", body: "Your wallet holds a Seeker Genesis Token. Verified Seekers are trusted first on bounties." };
  }
  if (tier.tier.reason === "sgt_claimed_by_another_wallet") {
    return {
      title: "You're a Scout",
      body: "This Seeker Genesis Token is already linked to another Scoutvy wallet, so this one stays unverified.",
    };
  }
  return {
    title: "You're a Scout",
    body: "No Seeker Genesis Token found in this wallet. You can still take bounties and build reputation.",
  };
}

export default function TierStep() {
  const { tier, refreshTier, session } = useSession();
  const text = copy(tier);
  const verified = tier.status === "ready" && tier.tier.tier === "verified_seeker";
  const address = session ? `${session.walletAddress.slice(0, 4)}…${session.walletAddress.slice(-4)}` : "";

  return (
    <Screen>
      <NavBar step={{ index: 1, count: ONBOARDING_STEPS }} />
      <Illustration
        source={verified ? require("@/assets/images/onboarding-seeker.png") : require("@/assets/images/onboarding-scout.png")}
        width={175}
        height={153}
        top={23.8}
      />
      <Title style={styles.title}>{text.title}</Title>
      <Subtitle style={styles.subtitle}>{text.body}</Subtitle>
      <Card
        icon={<Icon name={{ ios: "wallet.bifold", android: "account_balance_wallet", web: "account_balance_wallet" }} size={24} />}
        title={verified ? "Verified Seeker" : tier.status === "ready" ? "Scout" : "Wallet"}
        subtitle={address}
        accessory={
          tier.status === "loading" ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={[styles.badge, { backgroundColor: verified ? colors.success : colors.surfaceRaised }]}>
              <Icon
                name={
                  verified
                    ? { ios: "checkmark.seal.fill", android: "verified", web: "verified" }
                    : { ios: "person.fill", android: "person", web: "person" }
                }
                size={18}
              />
            </View>
          )
        }
      />
      <BottomActions>
        {tier.status === "error" ? (
          <Button label="Try Again" onPress={refreshTier} />
        ) : (
          <Button label="Next" disabled={tier.status === "loading"} onPress={() => router.push("/username")} />
        )}
      </BottomActions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 24 },
  subtitle: { marginTop: 13, marginBottom: 33 },
  badge: { width: 31, height: 31, borderRadius: 15.5, alignItems: "center", justifyContent: "center" },
});
