import { useSession } from "@/auth/session-context";
import { SettingsScreen, settingsStyle as s } from "@/settings/ui";
import { FlowFooter, FlowPill } from "@/components/ui/Flow";
import { Text, View, ActivityIndicator } from "react-native";
import { colors } from "@/theme";
export default function Verification() {
  const { tier, refreshTier } = useSession();
  const verified = tier.status === "ready" && tier.tier.tier === "verified_seeker";
  return (
    <SettingsScreen
      title="Wallet verification"
      footer={
        <FlowFooter
          label="Check again"
          loading={tier.status === "loading"}
          onPress={() => void refreshTier()}
        />
      }
    >
      <View style={s.card}>
        {tier.status === "loading" ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <FlowPill
            label={verified ? "SGT verified" : tier.status === "error" ? "Check unavailable" : "Scout"}
            tone={verified ? "green" : "neutral"}
          />
        )}
        <Text style={s.value}>
          {verified
            ? "Seeker Genesis Token found"
            : tier.status === "error"
              ? "Couldn’t check your wallet"
              : tier.status === "loading"
                ? "Checking your wallet…"
                : "No verified SGT linked"}
        </Text>
      </View>
      <Text style={s.body}>
        {verified
          ? "Verification confirms SGT ownership in this wallet."
          : tier.status === "ready" &&
              tier.tier.tier === "unverified" &&
              tier.tier.reason === "sgt_claimed_by_another_wallet"
            ? "This SGT is linked to another Scoutvy wallet."
            : "Your wallet is checked for a Seeker Genesis Token on Solana Mainnet."}
      </Text>
    </SettingsScreen>
  );
}
