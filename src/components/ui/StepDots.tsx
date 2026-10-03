import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme";

function Dot({ active }: { active: boolean }) {
  const width = useSharedValue(5);
  useEffect(() => {
    width.value = withTiming(active ? 15 : 5, { duration: 200, reduceMotion: ReduceMotion.System });
  }, [active, width]);
  const style = useAnimatedStyle(() => ({ width: width.value }));
  return <Animated.View style={[styles.dot, active && styles.active, style]} />;
}

export function StepDots({ index, count }: { index: number; count: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`Step ${index + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 3.3 },
  dot: { height: 5, borderRadius: 2.5, backgroundColor: colors.dotInactive },
  active: { backgroundColor: colors.button },
});
