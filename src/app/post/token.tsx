import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/auth/session-context";
import { Icon } from "@/components/ui/Icon";
import { RetryMessage } from "@/components/ui/RetryMessage";
import { Screen } from "@/components/ui/Screen";
import { useDraft } from "@/post/draft";
import { FundingCard } from "@/post/funding";
import { TOKEN_META } from "@/post/options";
import { NetworkBadge, PostHeader, PostHeading, PostNote } from "@/post/ui";
import { useBountyTokens } from "@/post/use-bounty-tokens";
import { colors, fonts } from "@/theme";
import { formatUnits } from "@/wallet/format";
export default function PostToken() {
  const { session } = useSession();
  const { draft, update } = useDraft();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { state, retry } = useBountyTokens(session);
  return (
    <Screen>
      <PostHeader step={3} title="Reward token" />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <PostHeading title="Choose a token" description="The token your scout receives after review." />
        <NetworkBadge />
        <Text style={s.section}>Available tokens</Text>
        {state.status === "loading" ? (
          <View style={s.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={s.caption}>Checking your wallet…</Text>
          </View>
        ) : state.status === "error" ? (
          <RetryMessage title="Couldn’t load balances" onRetry={retry} />
        ) : (
          <>
            <View style={s.tokens}>
              {state.tokens.map((token) => (
                <Pressable
                  key={token.mint}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${token.symbol}, balance ${formatUnits(token.amount, token.decimals)}`}
                  onPress={() => {
                    update({ token, amount: draft.token?.mint === token.mint ? draft.amount : "" });
                    if (edit === "1") router.replace({ pathname: "/post/amount", params: { edit: "1" } });
                    else router.push("/post/amount");
                  }}
                  style={({ pressed }) => [s.token, pressed && { backgroundColor: colors.surfaceRaised }]}
                >
                  <Image source={TOKEN_META[token.symbol].icon} style={s.icon} />
                  <View style={s.flex}>
                    <Text style={s.name}>{TOKEN_META[token.symbol].name}</Text>
                    <Text style={s.caption}>{token.symbol}</Text>
                  </View>
                  <View style={s.balance}>
                    <Text style={s.name}>{formatUnits(token.amount, token.decimals)}</Text>
                    <Text style={s.caption}>Available</Text>
                  </View>
                  <Icon
                    name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
              ))}
            </View>
            {state.tokens.every((token) => BigInt(token.amount) === 0n) ? (
              <FundingCard onRefresh={retry} />
            ) : (
              <View style={s.note}>
                <PostNote title="Held in escrow">
                  Your reward is locked when you post and released through the bounty’s review process.
                </PostNote>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
const s = StyleSheet.create({
  content: { paddingBottom: 24 },
  flex: { flex: 1 },
  section: {
    marginHorizontal: 20,
    marginTop: 32,
    marginBottom: 12,
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  tokens: { marginHorizontal: 20, borderRadius: 20, overflow: "hidden", gap: 1 },
  token: {
    minHeight: 88,
    padding: 16,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: { width: 44, height: 44, borderRadius: 22 },
  name: { fontFamily: fonts.semiBold, fontSize: 17, color: colors.text },
  caption: { marginTop: 5, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  balance: { alignItems: "flex-end" },
  loading: { padding: 36, alignItems: "center", gap: 12 },
  note: { marginTop: 24 },
});
