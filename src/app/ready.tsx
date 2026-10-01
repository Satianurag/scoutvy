import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";

import { useSession } from "@/auth/session-context";
import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Screen } from "@/components/ui/Screen";
import { Subtitle, Title } from "@/components/ui/Typography";
import { colors, fonts } from "@/theme";

export default function Ready() {
  const { profile, tier, finishOnboarding } = useSession();
  const { returning } = useLocalSearchParams<{ returning?: string }>();
  const [busy, setBusy] = useState(false);
  const verified = tier.status === "ready" && tier.tier.tier === "verified_seeker";
  const float = useSharedValue(0);
  const burst = useSharedValue(0);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    burst.set(withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    float.set(
      withDelay(
        900,
        withRepeat(withSequence(withTiming(-6, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1),
      ),
    );
  }, [float, burst]);

  const backdrop = useAnimatedStyle(() => ({
    opacity: burst.get(),
    transform: [{ scale: 1.6 - burst.get() * 0.6 }],
  }));
  const floating = useAnimatedStyle(() => ({ transform: [{ translateY: float.get() }] }));

  const start = async () => {
    setBusy(true);
    await finishOnboarding();
  };

  return (
    <Screen background={colors.celebration}>
      <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
        <Image
          source={require("@/assets/images/ready-background.png")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </Animated.View>
      <Animated.View entering={ZoomIn.springify().damping(11).delay(120)} style={styles.hello}>
        <Text style={styles.hi}>Hi!</Text>
      </Animated.View>
      <Animated.Text
        entering={FadeInDown.duration(420).delay(260)}
        style={styles.username}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        @{profile?.username}
      </Animated.Text>
      <Animated.View entering={ZoomIn.springify().damping(12).delay(380)}>
        <Animated.View style={floating}>
          <Image source={require("@/assets/images/ready-ghost.png")} style={styles.ghost} contentFit="contain" />
        </Animated.View>
      </Animated.View>
      <Reveal order={7}>
        <Title style={styles.title}>{returning ? "Welcome Back!" : "You're All Ready!"}</Title>
        <Subtitle style={styles.subtitle}>
          {verified ? "Verified Seeker. Start scouting bounties near you." : "Start scouting bounties near you."}
        </Subtitle>
      </Reveal>
      <BottomActions>
        <Reveal order={9}>
          <Button label="Get Started" onPress={start} loading={busy} />
        </Reveal>
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
