import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  ReduceMotion,
  withTiming,
  withSpring,
} from "react-native-reanimated";

import { colors, fonts, layout } from "@/theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "text";
  loading?: boolean;
  disabled?: boolean;
  size?: "regular" | "medium";
  style?: ViewStyle;
  containerStyle?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "regular",
  loading,
  disabled,
  style,
  containerStyle,
}: Props) {
  const inactive = disabled || loading;
  const foreground = variant === "primary" ? colors.onPrimary : colors.text;
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[pressStyle, containerStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPressIn={() => {
          scale.set(withTiming(0.98, { duration: 100, reduceMotion: ReduceMotion.System }));
        }}
        onPressOut={() => {
          scale.set(withSpring(1, { duration: 240, dampingRatio: 1, reduceMotion: ReduceMotion.System }));
        }}
        onPress={() => {
          onPress();
        }}
        style={({ pressed }) => [
          styles.base,
          variant === "primary" && styles.primary,
          variant === "secondary" && styles.secondary,
          variant === "text" && styles.text,
          size === "medium" && styles.medium,
          size === "medium" && variant === "primary" && styles.mediumPrimary,
          disabled && !loading && styles.disabled,
          pressed && styles.pressed,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={foreground} />
        ) : (
          <Text
            style={[
              styles.label,
              variant === "text" && styles.textLabel,
              size === "medium" && styles.mediumLabel,
              { color: foreground },
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    marginHorizontal: layout.gutter,
    minHeight: layout.buttonHeight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: layout.buttonRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.button },
  secondary: { backgroundColor: colors.surfaceRaised },
  text: { minHeight: 44 },
  medium: { marginHorizontal: 0, minHeight: 50, borderRadius: layout.buttonRadius },
  mediumPrimary: { backgroundColor: colors.primary },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fonts.semiBold, fontSize: 17.5, textAlign: "center" },
  textLabel: { fontSize: 16.5 },
  mediumLabel: { fontSize: 16 },
});
