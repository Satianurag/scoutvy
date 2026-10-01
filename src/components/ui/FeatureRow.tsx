import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme";

type Props = { icon: ReactNode; title: string; description: string };

export function FeatureRow({ icon, title, description }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>{icon}</View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginLeft: 16, marginRight: 24 },
  icon: { width: 42.7, paddingTop: 3, alignItems: "flex-start" },
  body: { flex: 1 },
  title: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, color: colors.text },
  description: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 14.9,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
