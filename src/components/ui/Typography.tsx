import type { PropsWithChildren } from "react";
import { StyleSheet, Text, type TextStyle } from "react-native";

import { colors, fonts } from "@/theme";

type Props = PropsWithChildren<{ style?: TextStyle }>;

export function Title({ children, style }: Props) {
  return (
    <Text accessibilityRole="header" style={[styles.title, style]}>
      {children}
    </Text>
  );
}

export function Subtitle({ children, style }: Props) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  heading: {
    marginHorizontal: 16,
    fontFamily: fonts.bold,
    fontSize: 21,
    lineHeight: 28,
    color: colors.text,
  },
  title: {
    marginHorizontal: 16,
    fontFamily: fonts.bold,
    fontSize: 27.5,
    lineHeight: 34,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    marginHorizontal: 36,
    fontFamily: fonts.regular,
    fontSize: 14.9,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
});

export function Heading({ children, style }: Props) {
  return (
    <Text accessibilityRole="header" numberOfLines={1} style={[styles.heading, style]}>
      {children}
    </Text>
  );
}
