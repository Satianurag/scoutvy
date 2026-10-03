import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme";

const LOGO = 133;

export function SplashTransition() {
  const [done, setDone] = useState(false);
  const logo = useSharedValue(0);
  const backdrop = useSharedValue(1);

  useEffect(() => {
    logo.set(
      withTiming(1, { duration: 200, reduceMotion: ReduceMotion.System, easing: Easing.in(Easing.cubic) }),
    );
    backdrop.set(
      withDelay(
        0,
        withTiming(
          0,
          { duration: 240, reduceMotion: ReduceMotion.System, easing: Easing.out(Easing.quad) },
          (finished) => {
            if (finished) runOnJS(setDone)(true);
          },
        ),
      ),
    );
  }, [logo, backdrop]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: 1 - logo.get(),
    transform: [{ scale: 1 + logo.get() * 0.06 }],
  }));

  if (done) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, backdropStyle]}>
      <Animated.View style={logoStyle}>
        <Image
          source={require("@/assets/images/scoutvy-splash.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: LOGO, height: LOGO },
});
