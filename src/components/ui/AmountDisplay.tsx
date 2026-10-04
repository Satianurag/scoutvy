import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme";

type Props = { amount: string; symbol: string; caption?: string; tone?: "default" | "error" | "warning"; compact?: boolean };

export function AmountDisplay({ amount, symbol, caption, tone = "default", compact }: Props) {
  const empty = amount === "" || amount === "0";
  return (
    <View style={styles.wrap}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.amount, compact && styles.compactAmount]} accessibilityLabel={`${amount || "0"} ${symbol}`}>
        <Text style={empty ? styles.placeholder : null}>{amount || "0"}</Text>
        <Text style={styles.unit}>{` ${symbol}`}</Text>
      </Text>
      {caption ? <Text accessibilityLiveRegion="polite" style={[styles.caption, compact && styles.compactCaption, tone === "error" && styles.error, tone === "warning" && styles.warning]}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, alignItems: "center", flexShrink: 1 },
  amount: { fontFamily: fonts.display, fontSize: 56, lineHeight: 66, color: colors.text, letterSpacing: -0.5 },
  unit: { fontFamily: fonts.medium, fontSize: 22, color: colors.textSecondary },
  placeholder: { color: colors.textSecondary },
  caption: { marginTop: 4, fontFamily: fonts.medium, fontSize: 17.5, lineHeight: 23, color: colors.textSecondary },
  error: { color: colors.danger },
  warning: { color: colors.orange },
  compactAmount: { fontSize: 40, lineHeight: 48 },
  compactCaption: { fontSize: 13, lineHeight: 18 },
});
