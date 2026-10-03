import { Image } from "expo-image";
import { router } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { ScreenReveal } from "@/components/ui/Motion";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAppDialog } from "@/components/ui/AppDialog";
import { WALLET_INSTALL_URL } from "@/constants/app-config";
import { colors, fonts } from "@/theme";
export default function Welcome() {
  const dialog = useAppDialog();
  return (
    <Screen>
      <View style={s.header}>
        <View style={s.brand}>
          <Image source={require("@/assets/images/scoutvy-mark.png")} style={{ width: 31, height: 24 }} />
          <Text style={s.wordmark}>scoutvy</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Help"
          onPress={() => router.push("/help")}
          style={s.help}
        >
          <Icon
            name={{ ios: "questionmark.circle", android: "help_outline", web: "help_outline" }}
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <ScreenReveal style={{ alignItems: "center" }}>
          <Image
            source={require("@/assets/images/onboarding-location.png")}
            style={s.hero}
            contentFit="contain"
          />
          <Text style={s.title}>Real answers.{"\n"}From nearby scouts.</Text>
          <Text style={s.subtitle}>
            Post a question about a place.{"\n"}Or scout nearby and capture the proof.
          </Text>
        </ScreenReveal>
      </ScrollView>
      <View style={s.actions}>
        <Button label="Connect wallet" onPress={() => router.push("/connect")} />
        <Button
          label="Get a wallet"
          variant="secondary"
          onPress={() =>
            void Linking.openURL(WALLET_INSTALL_URL).catch(() =>
              dialog({ title: "Couldn’t open the store", message: "Try again.", tone: "info" }),
            )
          }
        />
        <Text style={s.note}>Solana Devnet · Test tokens</Text>
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  header: { height: 64, marginHorizontal: 20, justifyContent: "center" },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  wordmark: { fontFamily: fonts.semiBold, fontSize: 23, color: colors.text, letterSpacing: -0.5 },
  help: {
    position: "absolute",
    right: 0,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flexGrow: 1, justifyContent: "center", paddingVertical: 18, paddingHorizontal: 24 },
  hero: { width: "100%", maxWidth: 300, height: 240, marginBottom: 22 },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -1,
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 16,
  },
  actions: { gap: 10, paddingTop: 12, paddingBottom: 18 },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
});
