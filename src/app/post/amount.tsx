import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Icon } from "@/components/ui/Icon";
import { Keypad } from "@/components/ui/Keypad";
import { Screen } from "@/components/ui/Screen";
import { useDraft } from "@/post/draft";
import { applyKey, toBaseUnits } from "@/post/amount";
import { REWARD_LIMITS, TOKEN_META } from "@/post/options";
import { NetworkBadge, PostFooter, PostHeader, usePostStep } from "@/post/ui";
import { colors, fonts } from "@/theme";
import { formatUnits } from "@/wallet/format";
export default function PostAmount() {
  const { height, fontScale } = useWindowDimensions();
  const compact = height < 700 || fontScale > 1.2;
  const { draft, update } = useDraft();
  const { editing, advance } = usePostStep("/post/duration");
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const token = draft.token;
  if (!token) return <Redirect href="/post/token" />;
  const unit = 10n ** BigInt(token.decimals);
  const balance = BigInt(token.amount);
  const max = balance < BigInt(REWARD_LIMITS.max) * unit ? balance : BigInt(REWARD_LIMITS.max) * unit;
  const value = toBaseUnits(draft.amount, token.decimals);
  const issue =
    value > 0n && value < unit
      ? `Minimum reward is 1 ${token.symbol}`
      : value > 500n * unit
        ? `Maximum reward is 500 ${token.symbol}`
        : null;
  const short = value > balance;
  return (
    <Screen>
      <PostHeader step={4} title="Set reward" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={[s.hero, compact && s.compactHero]}>
          {!compact && <NetworkBadge />}
          {!compact && <Text style={s.eyebrow}>Your scout’s reward</Text>}
          <View style={[s.valueGroup, compact && s.compactValue]}>
          <AmountDisplay
            compact={compact}
            amount={draft.amount}
            symbol={token.symbol}
            caption={issue ?? (compact && short ? `Add ${token.symbol} to post` : `${compact ? "Test mode · " : ""}1–500 ${token.symbol}`)}
            tone={issue ? "error" : compact && short ? "warning" : "default"}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change reward token"
            onPress={() =>
              editing ? router.replace({ pathname: "/post/token", params: { edit } }) : router.back()
            }
            style={[s.token, compact && s.compactToken]}
          >
            {!compact && <Image source={TOKEN_META[token.symbol].icon} style={s.icon} />}
            {!compact && <Text style={s.tokenLabel}>{TOKEN_META[token.symbol].name}</Text>}
            <Icon
              name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }}
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
          </View>
        </View>
        <View style={[s.balance, compact && { minHeight: 44 }]}>
          <Text style={s.balanceText}>
            Available{" "}
            <Text style={s.strong}>
              {formatUnits(token.amount, token.decimals)} {token.symbol}
            </Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use maximum available balance"
            disabled={max === 0n}
            onPress={() => update({ amount: formatUnits(max.toString(), token.decimals).replace(/,/g, "") })}
            style={s.max}
          >
            <Text style={[s.maxText, max === 0n && { color: colors.tabInactive }]}>Max</Text>
          </Pressable>
        </View>
        {short && !issue && !compact ? (
          <Text accessibilityLiveRegion="polite" style={s.warning}>
            You’ll need to add {token.symbol} before posting.
          </Text>
        ) : null}
        <Keypad
          compact={compact}
          onKey={(key) => update({ amount: applyKey(draft.amount, key, token.decimals) })}
          onClear={() => update({ amount: "" })}
        />
      </ScrollView>
      <PostFooter
        label={editing ? "Save reward" : "Choose duration"}
        disabled={value === 0n || issue !== null}
        onPress={advance}
      />
    </Screen>
  );
}
const s = StyleSheet.create({
  hero: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center" },
  compactHero: { minHeight: 0, paddingVertical: 4 },
  valueGroup: { alignItems: "center", maxWidth: "100%" },
  compactValue: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  compactToken: { marginTop: 0, padding: 0, width: 44, height: 44, justifyContent: "center" },
  eyebrow: {
    marginTop: 28,
    marginBottom: 12,
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textSecondary,
  },
  token: {
    marginTop: 24,
    padding: 9,
    paddingRight: 13,
    borderRadius: 24,
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  icon: { width: 24, height: 24, borderRadius: 12 },
  tokenLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  balance: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceRaised,
  },
  balanceText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  strong: { color: colors.text, fontFamily: fonts.medium },
  max: { padding: 12 },
  maxText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.primary },
  warning: {
    marginHorizontal: 20,
    marginTop: 9,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.orange,
  },
});
