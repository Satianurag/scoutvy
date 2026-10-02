import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { colors, fonts } from "@/theme";

type Props = {
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
};

export function EmptyState({ title, message, action, style }: Props) {
  return (
    <Reveal style={[styles.wrap, style]}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      {action ? (
        <View style={styles.action}>
          <Button label={action.label} size="medium" onPress={action.onPress} style={styles.button} />
        </View>
      ) : null}
    </Reveal>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: 36 },
  title: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22, color: colors.text, textAlign: "center" },
  message: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 14.9,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
  action: { marginTop: 18, alignSelf: "stretch", alignItems: "center" },
  button: { paddingHorizontal: 28 },
});
