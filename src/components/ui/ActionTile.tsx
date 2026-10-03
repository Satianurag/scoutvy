import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text } from "react-native";

import { ActionIcon, type ActionIconName } from "@/components/ui/ActionIcon";
import { colors, fonts } from "@/theme";

type Props = { icon: ActionIconName; label: string; onPress: () => void };

export function ActionTile({ icon, label, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <ActionIcon name={icon} size={25} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 68,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 16, color: colors.muted },
});
