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
    marginHorizontal: 20,
    fontFamily: fonts.semiBold,
    fontSize: 21,
    lineHeight: 28,
    color: colors.text,
  },
  title: {
    marginHorizontal: 20,
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    marginHorizontal: 36,
    fontFamily: fonts.regular,
    fontSize: 15,
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
