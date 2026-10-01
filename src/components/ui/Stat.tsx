import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme";

type Props = { label: string; value: string | null; minWidth?: number; onPress?: () => void };

export function Stat({ label, value, minWidth, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      disabled={!onPress}
      onPress={onPress}
      hitSlop={8}
      style={{ minWidth }}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueSlot}>
        {value === null ? (
          <ActivityIndicator size="small" color={colors.muted} />
        ) : (
          <Text style={styles.value}>{value}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.regular, fontSize: 13.75, lineHeight: 18.33, color: colors.muted },
  valueSlot: { height: 22, alignItems: "flex-start", justifyContent: "center" },
  value: { fontFamily: fonts.semiBold, fontSize: 17.5, lineHeight: 22, color: colors.text },
});
