import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme";

type Props = { name: string; size: number };

export function Avatar({ name, size }: Props) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: fonts.semiBold, color: colors.onPrimary },
});
