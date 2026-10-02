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
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Image source={icon} style={styles.icon} contentFit="cover" />
      <View style={styles.left}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.secondary}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.right}>
        <Text numberOfLines={1} style={styles.title}>
          {reward}
        </Text>
        <Text numberOfLines={1} style={styles.secondary}>
          {timeLeft}
        </Text>
      </View>
    </Pressable>
  );
}

export function BountyList({ children }: { children: ReactNode }) {
  return <View style={styles.list}>{children}</View>;
}

const styles = StyleSheet.create({
  list: {
    marginHorizontal: 16,
    paddingVertical: 5.5,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  row: { height: 72, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" },
  pressed: { backgroundColor: colors.surfaceRaised },
  icon: { width: 48, height: 48, borderRadius: 24 },
  left: { flex: 1, marginLeft: 12 },
  right: { marginLeft: 12, maxWidth: "40%", alignItems: "flex-end" },
  title: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, color: colors.text },
  secondary: { marginTop: 2, fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 19, color: colors.muted },
});
