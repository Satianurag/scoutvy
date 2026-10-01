import { StyleSheet, View } from "react-native";

import { colors } from "@/theme";

export function StepDots({ index, count }: { index: number; count: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`Step ${index + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i === index && styles.active]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 3.3 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.dotInactive },
  active: { width: 15, backgroundColor: colors.button },
});
