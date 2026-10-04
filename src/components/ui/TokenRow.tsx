import { Image, type ImageSource } from "expo-image";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme";
import type { Trend } from "@/wallet/format";

type Props = {
  icon: ImageSource;
  name: string;
  amount: string;
  value: string | null;
  change: string | null;
  trend: Trend;
  onPress?: () => void;
  disabled?: boolean;
  grouped?: boolean;
};

export function TokenRow({ icon, name, amount, value, change, trend, onPress, disabled, grouped }: Props) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ disabled }}
      disabled={!onPress || disabled}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [styles.row, grouped && styles.grouped, pressed && styles.pressed, disabled && styles.disabled]}
    >
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
    </Pressable>
  );
}

export const trendColor = StyleSheet.create({
  up: { color: colors.green },
  down: { color: colors.destructive },
  flat: { color: colors.muted },
});

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    paddingVertical: 12,
    marginHorizontal: 20,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  grouped: { marginHorizontal: 0, paddingHorizontal: 0, borderRadius: 0, minHeight: 76, backgroundColor: "transparent", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  disabled: { opacity: 0.5 },
  icon: { width: 40, height: 40, borderRadius: 20 },
  left: { flex: 1, marginLeft: 12 },
  right: { maxWidth: "45%", marginLeft: 12, alignItems: "flex-end" },
  name: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.text },
  amount: { marginTop: 2, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.muted },
  value: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.text },
  change: { marginTop: 2, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19 },
});
