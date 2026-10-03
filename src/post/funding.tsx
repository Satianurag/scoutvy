import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/auth/session-context";
import { Icon } from "@/components/ui/Icon";
import { colors, fonts } from "@/theme";

export function FundingCard({ onRefresh }: { onRefresh: () => void }) {
  const { session } = useSession();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  if (!session) return null;
  return (
    <View style={s.card}>
      <View style={s.heading}>
        <Icon
          name={{ ios: "wallet.pass", android: "account_balance_wallet", web: "account_balance_wallet" }}
          size={20}
          color={colors.primary}
        />
        <Text style={s.title}>Fund your devnet wallet</Text>
      </View>
      <Text style={s.body}>
        You can finish your draft now. To post, this wallet needs the selected test token and devnet SOL for
        network costs.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Copy wallet address"
        onPress={async () => {
          try {
            await Clipboard.setStringAsync(session.walletAddress);
            setCopied(true);
            setError(false);
          } catch {
            setError(true);
          }
        }}
        style={s.address}
      >
        <Text style={s.addressText}>
          {session.walletAddress.slice(0, 8)}…{session.walletAddress.slice(-8)}
        </Text>
        <Text style={s.copy}>{copied ? "Copied" : "Copy"}</Text>
      </Pressable>
      {error ? <Text style={s.body}>Couldn’t copy. Try again.</Text> : null}
      <Pressable accessibilityRole="button" onPress={onRefresh} style={s.refresh}>
        <Icon
          name={{ ios: "arrow.clockwise", android: "refresh", web: "refresh" }}
          size={17}
          color={colors.primary}
        />
        <Text style={s.copy}>Refresh balances</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 24, padding: 18, borderRadius: 20, backgroundColor: "#1C1923" },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  body: {
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  address: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  addressText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  copy: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary },
  refresh: {
    minHeight: 44,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
