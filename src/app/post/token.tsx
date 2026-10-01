import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/session-context";
import { NavBar } from "@/components/ui/NavBar";
import { Reveal } from "@/components/ui/Reveal";
import { Screen } from "@/components/ui/Screen";
import { TokenRow } from "@/components/ui/TokenRow";
import { useDraft } from "@/post/draft";
import { TOKEN_META } from "@/post/options";
import { useBountyTokens } from "@/post/use-bounty-tokens";
import { colors, fonts } from "@/theme";
import { formatUnits } from "@/wallet/format";

export default function PostToken() {
  const { session } = useSession();
  const { draft, update } = useDraft();
  const { state, retry } = useBountyTokens(session);

  return (
    <Screen>
      <NavBar title="Reward Token" />
      {state.status === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : state.status === "error" ? (
        <Pressable accessibilityRole="button" onPress={retry} style={styles.center}>
          <Text style={styles.errorTitle}>Couldn’t load balances</Text>
          <Text style={styles.errorAction}>Tap to retry</Text>
        </Pressable>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.caption}>Paid from your Solana Devnet balance</Text>
          <View style={styles.list}>
            {state.tokens.map((token, index) => {
              const meta = TOKEN_META[token.symbol];
              const empty = BigInt(token.amount) === 0n;
              return (
                <Reveal key={token.mint} order={index}>
                  <TokenRow
                    icon={meta.icon}
                    name={meta.name}
                    amount={empty ? `No ${token.symbol} yet` : `${formatUnits(token.amount, token.decimals)} ${token.symbol}`}
                    value={null}
                    change={null}
                    trend="flat"
                    disabled={empty}
                    onPress={() => {
                      update({ token, amount: draft.token?.mint === token.mint ? draft.amount : "" });
                      router.push("/post/amount");
                    }}
                  />
                </Reveal>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  errorTitle: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, color: colors.text },
  errorAction: { fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 20, color: colors.primary },
  content: { paddingTop: 12, paddingBottom: 24 },
  caption: {
    marginHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 14.9,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  list: { marginTop: 14, gap: 8.67 },
});
