import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { colors } from "@/theme";

type Props = { onPress: () => void };

const PLUS = 16.7;

export function PostButton({ onPress }: Props) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={pressStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Post a bounty"
        hitSlop={8}
        onPressIn={() => {
          scale.set(withTiming(0.96, { duration: 100, reduceMotion: ReduceMotion.System }));
        }}
        onPressOut={() => {
          scale.set(withTiming(1, { duration: 160, reduceMotion: ReduceMotion.System }));
        }}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          onPress();
        }}
        style={styles.circle}
      >
        <Svg width={PLUS} height={PLUS} viewBox="0 0 16.7 16.7">
          <Path d="M0 8.35H16.7M8.35 0V16.7" stroke={colors.onPost} strokeWidth={2} />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.post,
    alignItems: "center",
    justifyContent: "center",
  },
});
