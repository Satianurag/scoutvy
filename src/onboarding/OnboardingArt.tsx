import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { SvgXml } from "react-native-svg";
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { artwork } from "./art/layers";

type ArtName = keyof typeof artwork;

function ArtLayer({ xml, motion, index, active }: { xml: string; motion: string; index: number; active: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(0);
    if (active) progress.set(withDelay(index * 35, withTiming(1, {
      duration: 620, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
    }), ReduceMotion.System));
    return () => cancelAnimation(progress);
  }, [active, index, progress]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * (motion === "card" ? 30 : motion === "satellite" ? -16 : 12) },
      { scale: 0.94 + progress.value * 0.06 },
      { rotate: `${(1 - progress.value) * (motion === "satellite" ? 9 : -3)}deg` },
    ],
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
    <SvgXml xml={xml} width="100%" height="100%" />
  </Animated.View>;
}

/** Decorative, local vectors. All animation runs on the UI thread and respects reduced motion. */
export function OnboardingArt({ name, size = 300, active = true }: { name: ArtName; size?: number; active?: boolean }) {
  const { height, fontScale } = useWindowDimensions();
  const fittedSize = Math.min(size, height < 700 ? fontScale > 1.2 ? 80 : 150 : size);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: fittedSize, height: fittedSize * 350 / 380 }}>
    {artwork[name].map((layer, index) => <ArtLayer key={`${name}-${index}`} {...layer} index={index} active={active} />)}
  </View>;
}
