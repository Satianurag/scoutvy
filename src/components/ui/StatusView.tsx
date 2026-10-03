import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { Reveal } from "@/components/ui/Reveal";
import { colors, fonts } from "@/theme";

type Props = {
  state: "pending" | "success" | "failure";
  title: string;
  message: ReactNode;
  link?: { label: string; onPress: () => void };
};

export function StatusView({ state, title, message, link }: Props) {
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      {state === "pending" ? (
        <View style={styles.badge}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <Animated.View
          key={state}
          entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
          style={[styles.badge, state === "success" ? styles.success : styles.failure]}
        >
          <Svg width={34} height={34} viewBox="0 0 34 34" fill="none">
            {state === "success" ? (
              <Path
                d="M7 17.5L14 24.5L27.5 10"
                stroke={colors.background}
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <Path
                d="M17 8.5V19.5M17 25.5V25.6"
                stroke={colors.background}
                strokeWidth={3.4}
                strokeLinecap="round"
              />
            )}
          </Svg>
        </Animated.View>
      )}
      <Reveal key={title} style={styles.text}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.message}>{message}</Text>
        {link ? (
          <Pressable accessibilityRole="link" hitSlop={10} onPress={link.onPress}>
            <Text style={styles.link}>{link.label}</Text>
          </Pressable>
        ) : null}
      </Reveal>
    </View>
  );
}

export const statusEmphasis = StyleSheet.create({ strong: { color: colors.text } });

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  badge: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  success: { backgroundColor: colors.green },
  failure: { backgroundColor: colors.danger },
  text: { marginTop: 20, width: "100%", alignItems: "center" },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
    textAlign: "center",
  },
  message: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: "center",
  },
  link: { marginTop: 18, fontFamily: fonts.semiBold, fontSize: 17, color: colors.primary },
});
