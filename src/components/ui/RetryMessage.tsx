import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { colors, fonts } from "@/theme";

type Props = { title: string; onRetry: () => void; style?: StyleProp<ViewStyle> };

export function RetryMessage({ title, onRetry, style }: Props) {
  return (
    <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={12} style={[styles.wrap, style]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.action}>Tap to retry</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", alignItems: "center", gap: 4 },
  title: { alignSelf: "stretch", textAlign: "center", fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, color: colors.text },
  action: { alignSelf: "stretch", textAlign: "center", fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 20, color: colors.primary },
});
