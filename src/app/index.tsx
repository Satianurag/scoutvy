import { Image } from "expo-image";
import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WALLET_INSTALL_URL } from "@/constants/app-config";
import { colors, fonts } from "@/theme";

export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={require("@/assets/images/scoutvy-mark.png")} style={styles.mark} />
          <Text style={styles.wordmark}>scoutvy</Text>
        </View>
        <Pressable style={styles.help} hitSlop={12}>
          <Text style={styles.helpText}>?</Text>
        </Pressable>
      </View>

      <Animated.View entering={ZoomIn.springify().damping(14).delay(180)}>
        <Image source={require("@/assets/images/welcome-hero.png")} style={styles.hero} />
      </Animated.View>

      <View style={styles.spacer} />

      <Text style={styles.eyebrow}>Trusted by scouts worldwide</Text>
      <Text style={styles.title}>Your home for verifying places, prices, and more</Text>

      <Text style={styles.terms}>
        By continuing, you agree to the <Text style={styles.link}>Terms</Text> and{"\n"}
        <Text style={styles.link}>Privacy Policy</Text>
      </Text>

      <Pressable style={styles.primary} onPress={() => router.push("/connect")}>
        <Text style={styles.primaryText}>Connect a Wallet</Text>
      </Pressable>

      <Pressable style={styles.secondary} onPress={() => Linking.openURL(WALLET_INSTALL_URL)}>
        <Text style={styles.secondaryText}>I Don&apos;t Have a Wallet</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 44,
    marginTop: 10.8,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
  },
  mark: {
    width: 33.5,
    height: 24.7,
    marginRight: 2.4,
  },
  wordmark: {
    fontFamily: fonts.bold,
    fontSize: 23.5,
    letterSpacing: 0.8,
    color: colors.text,
  },
  help: {
    position: "absolute",
    right: 23.7,
    width: 22.7,
    height: 22.7,
    borderRadius: 11.35,
    borderWidth: 2,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  helpText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
  },
  hero: {
    alignSelf: "center",
    marginLeft: -12,
    marginTop: 21.2,
    width: 317,
    height: 310,
  },
  spacer: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 16.67,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
  title: {
    marginTop: 8.6,
    alignSelf: "center",
    width: 361,
    fontFamily: fonts.bold,
    fontSize: 33.1,
    lineHeight: 40.8,
    color: colors.text,
    textAlign: "center",
  },
  terms: {
    marginTop: 39.2,
    fontFamily: fonts.semiBold,
    fontSize: 14.9,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: "center",
  },
  link: {
    color: colors.primary,
  },
  primary: {
    marginTop: 14,
    marginHorizontal: 16.67,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.button,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontFamily: fonts.semiBold,
    fontSize: 17.5,
    color: colors.onPrimary,
  },
  secondary: {
    height: 46,
    marginTop: 13,
    marginBottom: 18.2,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontFamily: fonts.semiBold,
    fontSize: 16.5,
    color: colors.text,
  },
});
