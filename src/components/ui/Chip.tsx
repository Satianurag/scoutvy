import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, fonts } from "@/theme";

type Props = { label: string; selected: boolean; onPress: () => void };

export function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && !selected && styles.pressed]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { backgroundColor: colors.primary },
  pressed: { backgroundColor: colors.surfaceRaised },
  label: { fontFamily: fonts.semiBold, fontSize: 14.9, color: colors.text },
  selectedLabel: { color: colors.onPrimary },
});
