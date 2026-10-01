import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme";

type Props = { icon: ReactNode; title: string; subtitle: string; accessory?: ReactNode };

export function Card({ icon, title, subtitle, accessory }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>{icon}</View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    minHeight: 74,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 19.7,
    borderRadius: 18,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
  },
  icon: { width: 37, alignItems: "flex-start" },
  body: { flex: 1, paddingRight: 8 },
  title: { fontFamily: fonts.semiBold, fontSize: 16.5, lineHeight: 21, color: colors.text },
  subtitle: {
    marginTop: 1,
    fontFamily: fonts.regular,
    fontSize: 14.9,
    lineHeight: 19,
    color: colors.textSecondary,
  },
});
