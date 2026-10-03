import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors, fonts } from "@/theme";

type Props = {
  label: string;
  icon?: ReactNode;
  value?: string;
  tone?: "default" | "destructive";
  onPress?: () => void;
};

export function ListRow({ label, icon, value, tone = "default", onPress }: Props) {
  const chevron = Boolean(onPress) && tone === "default";
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        icon ? styles.withIcon : styles.plain,
        chevron ? styles.withChevron : styles.noChevron,
        pressed && styles.pressed,
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, tone === "destructive" && styles.destructive]}>
        {label}
      </Text>
      {value ? (
        <Text numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      {chevron ? (
        <Svg width={7} height={12} viewBox="0 0 7 12" fill="none" style={styles.chevron}>
          <Path
            d="M1 1L5.8 6L1 11"
            stroke={colors.muted}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  withIcon: { paddingLeft: 16 },
  plain: { paddingLeft: 16 },
  withChevron: { paddingRight: 18 },
  noChevron: { paddingRight: 20 },
  pressed: { backgroundColor: colors.surfaceRaised },
  icon: { width: 30 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  destructive: { color: colors.destructive },
  value: { marginLeft: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.muted, maxWidth: "45%" },
  chevron: { marginLeft: 15 },
});
