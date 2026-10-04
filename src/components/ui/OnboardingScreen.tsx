import type { PropsWithChildren, ReactNode } from "react";
import { Image, type ImageSource } from "expo-image";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { NavBar } from "@/components/ui/NavBar";
import { ScreenReveal } from "@/components/ui/Motion";
import { colors, fonts } from "@/theme";
export function OnboardingScreen({
  title,
  subtitle,
  image,
  artwork,
  children,
  footer,
  back = true,
  step,
  onHelp,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  image?: ImageSource;
  artwork?: ReactNode;
  footer: ReactNode;
  back?: boolean;
  step?: { index: number; count: number };
  onHelp?: () => void;
}>) {
  return (
    <Screen>
      <NavBar back={back} step={step} onHelp={onHelp} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <ScreenReveal style={s.hero}>
          {artwork}
          {image && <Image source={image} style={s.image} contentFit="contain" />}
          <Text accessibilityRole="header" style={s.title}>
            {title}
          </Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </ScreenReveal>
        <View style={s.children}>{children}</View>
      </ScrollView>
      <View style={s.footer}>{footer}</View>
    </Screen>
  );
}
const s = StyleSheet.create({
  body: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  hero: { alignItems: "center", gap: 14, marginHorizontal: 24 },
  image: { width: 164, height: 150, marginBottom: 18 },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 35,
    letterSpacing: -0.7,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 330,
  },
  children: { marginTop: 32, gap: 16 },
  footer: { paddingTop: 12, paddingBottom: 18, gap: 10 },
});
