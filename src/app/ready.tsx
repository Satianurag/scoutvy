import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { useSession } from "@/auth/session-context";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";
import { colors, fonts } from "@/theme";

export default function Ready() {
  const { profile, tier, finishOnboarding } = useSession();
  const verified = tier.status === "ready" && tier.tier.tier === "verified_seeker";

  return (
    <Screen background={colors.celebration}>
      <Image source={require("@/assets/images/ready-background.png")} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={styles.hello}>
        <Text style={styles.hi}>Hi!</Text>
      </View>
      <Text style={styles.username} numberOfLines={1} adjustsFontSizeToFit>
        @{profile?.username}
      </Text>
      <Image source={require("@/assets/images/ready-ghost.png")} style={styles.ghost} contentFit="contain" />
      <Title style={styles.title}>You&apos;re All Ready!</Title>
      <Subtitle style={styles.subtitle}>
        {verified ? "Verified Seeker. Start scouting bounties near you." : "Start scouting bounties near you."}
      </Subtitle>
      <BottomActions>
        <Button label="Get Started" onPress={finishOnboarding} />
      </BottomActions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: {
    marginTop: 33,
    alignSelf: "center",
    width: 132,
    height: 96,
    borderRadius: 66,
    backgroundColor: "#F9D4D2",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  hi: { fontFamily: fonts.medium, fontSize: 70, lineHeight: 84, color: colors.button, marginTop: -26 },
  username: {
    marginTop: 18,
    marginHorizontal: 24,
    fontFamily: fonts.medium,
    fontSize: 27.5,
    color: colors.text,
    textAlign: "center",
  },
  ghost: { marginTop: 48, alignSelf: "center", width: 140, height: 128 },
  title: { marginTop: 50 },
  subtitle: { marginTop: 8 },
});
