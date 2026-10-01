import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme";

type Props = { amount: string; symbol: string; caption?: string; tone?: "default" | "error" };

export function AmountDisplay({ amount, symbol, caption, tone = "default" }: Props) {
  const empty = amount === "" || amount === "0";
  return (
    <View style={styles.wrap}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.amount} accessibilityLabel={`${amount || "0"} ${symbol}`}>
        <Text style={empty ? styles.placeholder : null}>{amount || "0"}</Text>
        {`  ${symbol}`}
      </Text>
      {caption ? <Text style={[styles.caption, tone === "error" && styles.error]}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, alignItems: "center" },
  amount: { fontFamily: fonts.semiBold, fontSize: 56, lineHeight: 66, color: colors.text, letterSpacing: -0.5 },
  placeholder: { color: colors.textSecondary },
  caption: { marginTop: 4, fontFamily: fonts.medium, fontSize: 17.5, lineHeight: 23, color: colors.textSecondary },
  error: { color: colors.danger },
});
