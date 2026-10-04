import type { ReactNode } from "react";
import { Image, type ImageSource } from "expo-image";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme";

type Props = {
  icon: ImageSource;
  title: string;
  subtitle: string;
  reward: string;
  timeLeft: string;
  onPress: () => void;
};

export function BountyRow({ icon, title, subtitle, reward, timeLeft, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${reward}, ${subtitle}, ${timeLeft}`}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <Text numberOfLines={3} style={styles.title}>{title}</Text>
        <Text style={styles.secondary}>{timeLeft}</Text>
      </View>
      <Text numberOfLines={2} style={styles.secondary}>{subtitle}</Text>
      <View style={styles.rewardRow}>
        <Image source={icon} style={styles.icon} contentFit="cover" />
        <Text style={styles.reward}>{reward}</Text>
      </View>
    </Pressable>
  );
}

export function BountyList({ children }: { children: ReactNode }) {
  return <View style={styles.list}>{children}</View>;
}

const styles = StyleSheet.create({
  list: { marginHorizontal: 20, gap: 16 },
  row: { paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 12 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  title: { flex: 1, fontFamily: fonts.semiBold, fontSize: 22, lineHeight: 28, color: colors.text },
  secondary: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { width: 24, height: 24, borderRadius: 12 },
  reward: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 23, color: colors.text, fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.65 },
});
