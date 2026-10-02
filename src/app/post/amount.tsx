import { router } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { Keypad } from "@/components/ui/Keypad";
import { NavBar } from "@/components/ui/NavBar";
import { Screen } from "@/components/ui/Screen";
import { useDraft } from "@/post/draft";
import { applyKey, toBaseUnits } from "@/post/amount";
import { REWARD_LIMITS } from "@/post/options";
import { colors, fonts, layout } from "@/theme";
import { formatUnits } from "@/wallet/format";

export default function PostAmount() {
  const { draft, update } = useDraft();
  const compact = useWindowDimensions().height < COMPACT_HEIGHT;
  const token = draft.token;
  if (!token) return null;

  const unit = 10n ** BigInt(token.decimals);
  const balance = BigInt(token.amount);
  const max = balance < BigInt(REWARD_LIMITS.max) * unit ? balance : BigInt(REWARD_LIMITS.max) * unit;
  const value = toBaseUnits(draft.amount, token.decimals);

  const issue =
    value === 0n
      ? null
      : value > balance
        ? `Exceeds your ${token.symbol} balance`
        : value < BigInt(REWARD_LIMITS.min) * unit
          ? `Minimum reward is ${REWARD_LIMITS.min} ${token.symbol}`
          : value > BigInt(REWARD_LIMITS.max) * unit
            ? `Maximum reward is ${REWARD_LIMITS.max} ${token.symbol}`
            : null;
  const valid = value > 0n && issue === null;

  return (
    <Screen>
      <NavBar
        title="Reward"
        action={{
          label: "Next",
          disabled: !valid,
          onPress: () => router.push("/post/duration"),
        }}
      />
      {compact ? null : (
        <View style={styles.for}>
          <Text numberOfLines={1} style={styles.forText}>
            <Text style={styles.forLabel}>For: </Text>
            {draft.title.trim()}
          </Text>
        </View>
      )}
      <View style={styles.amount}>
        <AmountDisplay
          amount={draft.amount}
          symbol={token.symbol}
          caption={issue ?? `${REWARD_LIMITS.min}–${REWARD_LIMITS.max} ${token.symbol}`}
          tone={issue ? "error" : "default"}
        />
      </View>
      <View style={styles.available}>
        <View style={styles.flex}>
          <Text style={styles.availableLabel}>Available</Text>
          <Text numberOfLines={1} style={styles.availableValue}>
            {formatUnits(token.amount, token.decimals)} {token.symbol}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            update({
              amount: formatUnits(max.toString(), token.decimals).replace(/,/g, ""),
            })
          }
          style={({ pressed }) => [styles.max, pressed && styles.maxPressed]}
        >
          <Text style={styles.maxLabel}>Max</Text>
        </Pressable>
      </View>
      <View style={styles.keypad}>
        <Keypad
          onKey={(key) => update({ amount: applyKey(draft.amount, key, token.decimals) })}
          onClear={() => update({ amount: "" })}
        />
      </View>
    </Screen>
  );
}

const COMPACT_HEIGHT = 600;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  for: {
    height: 49,
    paddingHorizontal: layout.gutter,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceRaised,
  },
  forText: { fontFamily: fonts.semiBold, fontSize: 16.5, color: colors.text },
  forLabel: { color: colors.textSecondary },
  amount: { flex: 1, minHeight: 112, justifyContent: "center" },
  available: {
    height: 66,
    paddingHorizontal: layout.gutter,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceRaised,
  },
  availableLabel: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  availableValue: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
  },
  max: {
    marginLeft: 12,
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  maxPressed: { backgroundColor: colors.surfaceRaised },
  maxLabel: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
  keypad: { flexShrink: 1, paddingTop: 6, paddingBottom: layout.bottomGap },
});
