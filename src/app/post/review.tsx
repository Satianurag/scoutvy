import { Image } from "expo-image";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/auth/session-context";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { useDraft } from "@/post/draft";
import { normalizeAmount, toBaseUnits } from "@/post/amount";
import { FundingCard } from "@/post/funding";
import { DURATION_OPTIONS, TOKEN_META, formatRadius } from "@/post/options";
import { NetworkBadge, PostFooter, PostHeader, postStyles } from "@/post/ui";
import { useBountyTokens } from "@/post/use-bounty-tokens";
import { colors, fonts } from "@/theme";

export default function PostReview() {
  const { draft } = useDraft();
  const { session } = useSession();
  const { state, retry } = useBountyTokens(session);
  const posting = useRef(false);
  useFocusEffect(
    useCallback(() => {
      posting.current = false;
      retry();
    }, [retry]),
  );
  const { token, place } = draft;
  if (draft.title.trim().length < 4 || draft.instructions.trim().length < 10) return <Redirect href="/post" />;
  if (draft.taskMode === "on_site" && !place) return <Redirect href="/post/location" />;
  if (!token) return <Redirect href="/post/token" />;
  if (toBaseUnits(draft.amount, token.decimals) === 0n) return <Redirect href="/post/amount" />;
  const liveToken = state.status === "ready" ? state.tokens.find((item) => item.mint === token.mint) : null;
  const value = toBaseUnits(draft.amount, token.decimals);
  const enough = liveToken != null && BigInt(liveToken.amount) >= value;
  const valid =
    value >= 10n ** BigInt(token.decimals) &&
    value <= 500n * 10n ** BigInt(token.decimals) &&
    draft.title.trim().length >= 4 &&
    draft.instructions.trim().length >= 10;
  const duration = DURATION_OPTIONS.find((option) => option.hours === draft.durationHours);
  const edit = (pathname: "/post" | "/post/location" | "/post/amount" | "/post/duration") =>
    router.push({ pathname, params: { edit: "1" } });
  return (
    <Screen>
      <PostHeader step={6} title="Review bounty" />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Image source={TOKEN_META[token.symbol].icon} style={s.coin} />
          <Text style={s.reward} adjustsFontSizeToFit numberOfLines={1}>
            {normalizeAmount(draft.amount)} <Text style={s.symbol}>{token.symbol}</Text>
          </Text>
          <Text style={s.caption}>Locked in escrow when you post</Text>
          <View style={s.network}>
            <NetworkBadge />
          </View>
        </View>
        <Text style={postStyles.label}>BOUNTY DETAILS</Text>
        <View style={postStyles.group}>
          <ReviewRow label="Request" value={draft.title.trim()} onPress={() => edit("/post")} />
          <ReviewRow
            label="Location"
            value={draft.taskMode === "remote" ? "Online" : place!.label}
            detail={draft.taskMode === "on_site" && draft.proofType === "photo" ? `Within ${formatRadius(draft.radiusM)} of the pin` : undefined}
            onPress={() => edit(draft.taskMode === "remote" ? "/post" : "/post/location")}
          />
          <ReviewRow
            label="Reward"
            value={`${normalizeAmount(draft.amount)} ${token.symbol}`}
            onPress={() => edit("/post/amount")}
          />
          <ReviewRow
            label="Duration"
            value={`${duration?.label} after posting`}
            onPress={() => edit("/post/duration")}
            last
          />
        </View>
        <View style={s.proof}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit bounty requirements"
            onPress={() => edit("/post")}
            style={s.proofHeader}
          >
            <Text style={s.proofLabel}>Requirements</Text>
            <Text style={s.edit}>Edit</Text>
          </Pressable>
          <Text style={s.instructions}>{draft.instructions.trim()}</Text>
          <Text style={s.proofMethod}>{draft.proofType === "photo" ? "Submission: a fresh photo at the chosen location." : "Submission: written response or work link."}</Text>
        </View>
        <View style={s.cost}>
          <Text style={s.costLabel}>Network & account costs</Text>
          <Text style={s.costValue}>Paid in SOL</Text>
        </View>
        <Text style={s.costNote}>Your wallet shows the final transaction before you approve.</Text>
        {state.status === "loading" ? (
          <View style={s.checking}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={s.costLabel}>Checking available balance…</Text>
          </View>
        ) : state.status === "error" ? (
          <Pressable accessibilityRole="button" onPress={retry} style={s.checking}>
            <Text style={s.edit}>Couldn’t check balance. Tap to retry.</Text>
          </Pressable>
        ) : !enough ? (
          <FundingCard onRefresh={retry} />
        ) : null}
      </ScrollView>
      <PostFooter
        note={
          state.status === "loading"
            ? "Checking your wallet before posting…"
            : state.status === "error"
              ? "Refresh your balance to continue."
              : enough
                ? "Next, approve in your wallet to lock the reward."
                : "Your draft is ready. Add funds to post it."
        }
        label="Post bounty"
        disabled={!enough || !valid || state.status !== "ready"}
        onPress={() => {
          if (posting.current) return;
          posting.current = true;
          router.navigate("/post/status");
        }}
      />
    </Screen>
  );
}
function ReviewRow({
  label,
  value,
  detail,
  onPress,
  last,
}: {
  label: string;
  value: string;
  detail?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${label.toLowerCase()}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        !last && s.divider,
        pressed && { backgroundColor: colors.surfaceRaised },
      ]}
    >
      <View style={s.flex}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue}>{value}</Text>
        {detail ? <Text style={s.rowDetail}>{detail}</Text> : null}
      </View>
      <Icon
        name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
        size={19}
        color={colors.textSecondary}
      />
    </Pressable>
  );
}
const s = StyleSheet.create({
  content: { paddingBottom: 24 },
  flex: { flex: 1 },
  hero: { alignItems: "center", paddingTop: 14, paddingBottom: 30 },
  coin: { width: 44, height: 44, borderRadius: 22, marginBottom: 12 },
  reward: {
    fontFamily: fonts.semiBold,
    fontSize: 46,
    lineHeight: 58,
    letterSpacing: -1.4,
    color: colors.text,
    marginHorizontal: 20,
  },
  symbol: { color: colors.textSecondary },
  caption: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  network: { marginTop: 16 },
  row: { paddingHorizontal: 18, paddingVertical: 15, flexDirection: "row", alignItems: "center", gap: 16 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#353535" },
  rowLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  rowValue: { marginTop: 5, fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.text },
  rowDetail: { marginTop: 4, fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  proof: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    backgroundColor: colors.surface,
  },
  proofHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 28 },
  proofLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  edit: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },
  instructions: { marginTop: 8, fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.text },
  proofMethod: { marginTop: 12, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  cost: {
    marginHorizontal: 20,
    marginTop: 22,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  costLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary },
  costValue: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  costNote: {
    marginHorizontal: 20,
    marginTop: 7,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  checking: { padding: 24, gap: 10, flexDirection: "row", alignItems: "center", justifyContent: "center" },
});
