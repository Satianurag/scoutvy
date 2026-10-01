import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import { colors, fonts, layout } from "@/theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "text";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = "primary", loading, disabled, style }: Props) {
  const inactive = disabled || loading;
  const foreground = variant === "primary" ? colors.onPrimary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "text" && styles.text,
        disabled && !loading && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text style={[styles.label, variant === "text" && styles.textLabel, { color: foreground }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    marginHorizontal: layout.gutter,
    height: layout.buttonHeight,
    borderRadius: layout.buttonRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.button },
  secondary: { backgroundColor: colors.surfaceRaised },
  text: { height: 24 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  label: { fontFamily: fonts.semiBold, fontSize: 17.5 },
  textLabel: { fontSize: 16.5 },
});
