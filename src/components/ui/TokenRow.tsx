import { Image, type ImageSource } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme";
import type { Trend } from "@/wallet/format";

type Props = {
  icon: ImageSource;
  name: string;
  amount: string;
  value: string | null;
  change: string | null;
  trend: Trend;
};

export function TokenRow({ icon, name, amount, value, change, trend }: Props) {
  return (
    <View style={styles.row}>
      <Image source={icon} style={styles.icon} contentFit="cover" />
      <View style={styles.left}>
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        <Text numberOfLines={1} style={styles.amount}>
          {amount}
        </Text>
      </View>
      {value !== null ? (
        <View style={styles.right}>
          <Text numberOfLines={1} style={styles.value}>
            {value}
          </Text>
          {change !== null ? (
            <Text numberOfLines={1} style={[styles.change, trendColor[trend]]}>
              {change}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const trendColor = StyleSheet.create({
  up: { color: colors.green },
  down: { color: colors.destructive },
  flat: { color: colors.muted },
});

const styles = StyleSheet.create({
  row: {
    height: 74,
    marginHorizontal: 16,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  icon: { width: 48, height: 48, borderRadius: 24 },
  left: { flex: 1, marginLeft: 12 },
  right: { marginLeft: 12, alignItems: "flex-end" },
  name: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, color: colors.text },
  amount: { marginTop: 2, fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 19, color: colors.muted },
  value: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, color: colors.text },
  change: { marginTop: 2, fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 19 },
});
