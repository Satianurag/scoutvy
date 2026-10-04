import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { colors, fonts, layout } from "@/theme";
import { OnboardingArt } from "./OnboardingArt";

const scenes = [
  { art: "possibility", title: "Big ideas.\nMeet go-getters.", body: "Post a bounty. Find a challenge.\nMake something happen." },
  { art: "brief", title: "Your task.\nYour terms.", body: "Set your requirements and reward.\nOnline or out in the world." },
  { art: "reward", title: "Good work.\nWell rewarded.", body: "Fund the reward upfront.\nRelease it when you approve the work." },
] as const;

function SceneArt({ index, offset, width, size }: { index: number; offset: SharedValue<number>; width: number; size: number }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const distance = Math.max(-1, Math.min(1, offset.value / width - index));
    return { transform: [{ translateX: reduced ? 0 : distance * 36 }, { scale: reduced ? 1 : 1 - Math.abs(distance) * 0.08 }] };
  });
  return <Animated.View style={style}><OnboardingArt name={scenes[index].art} size={size} /></Animated.View>;
}

function Dot({ index, offset, width }: { index: number; offset: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(offset.value / width - index);
    return { width: interpolate(distance, [0, 1], [22, 6], Extrapolation.CLAMP), opacity: interpolate(distance, [0, 1], [1, 0.35], Extrapolation.CLAMP) };
  });
  return <Animated.View style={[s.dot, style]} />;
}

export function Introduction({ onContinue, returning = false }: { onContinue: () => void; returning?: boolean }) {
  const { width, height, fontScale } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const offset = useSharedValue(0);
  const reduced = useReducedMotion();
  const scroll = useAnimatedScrollHandler(event => { offset.value = event.contentOffset.x; });
  const go = (next: number) => {
    setPage(next);
    pager.current?.scrollTo({ x: next * width, animated: !reduced });
  };
  useEffect(() => {
    pager.current?.scrollTo({ x: page * width, animated: false });
    // Resize preserves the current scene; page changes use the animated go handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (page === 0) return false;
      setPage(page - 1);
      pager.current?.scrollTo({ x: (page - 1) * width, animated: !reduced });
      return true;
    });
    return () => subscription.remove();
  }, [page, reduced, width]);
  const artSize = Math.min(width - 48, height < 700 || fontScale > 1.3 ? 225 : 330);
  return <Screen>
    <View style={s.header}>
      <View style={s.brand}>
        <Image source={require("@/assets/images/scoutvy-mark.png")} style={s.mark} />
        <Text style={s.wordmark}>scoutvy</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onContinue} style={s.skip}>
        <Text style={s.skipLabel}>Skip</Text>
      </Pressable>
    </View>
    <Animated.ScrollView ref={pager} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false}
      onScroll={scroll} scrollEventThrottle={16} onMomentumScrollEnd={event => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
      style={s.pager}>
      {scenes.map((scene, index) => <ScrollView key={scene.art} style={{ width }} contentContainerStyle={s.scene}
        showsVerticalScrollIndicator={false} accessibilityElementsHidden={page !== index} importantForAccessibility={page === index ? "auto" : "no-hide-descendants"}>
        <SceneArt index={index} offset={offset} width={width} size={artSize} />
        <Text accessibilityRole="header" style={[s.title, height < 700 && s.compactTitle]}>{scene.title}</Text>
        <Text style={[s.body, height < 700 && s.compactBody]}>{scene.body}</Text>
      </ScrollView>)}
    </Animated.ScrollView>
    <View style={s.pagination}>
      {scenes.map((scene, index) => <Pressable key={scene.art} accessibilityRole="button"
        accessibilityLabel={`Introduction ${index + 1} of ${scenes.length}`} accessibilityState={{ selected: page === index }}
        onPress={() => go(index)} style={s.dotTarget}><Dot index={index} offset={offset} width={width} /></Pressable>)}
    </View>
    <View style={s.footer}>
      <Button label={page === scenes.length - 1 ? "Get started" : "Continue"} onPress={() => page === scenes.length - 1 ? onContinue() : go(page + 1)} />
      <Button label={returning ? "Back to Scoutvy" : "I already have a wallet"} variant="text" onPress={onContinue} />
      <Text style={s.note}>Test mode · No real-money rewards</Text>
    </View>
  </Screen>;
}

const s = StyleSheet.create({
  header: { minHeight: 64, marginHorizontal: layout.gutter, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 },
  mark: { width: 31, height: 24 },
  wordmark: { fontFamily: fonts.semiBold, fontSize: 23, letterSpacing: -0.5, color: colors.text },
  skip: { minWidth: 48, minHeight: 48, justifyContent: "center", alignItems: "flex-end" },
  skipLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  pager: { flex: 1 },
  scene: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 12 },
  title: { fontFamily: fonts.display, color: colors.text, textAlign: "center", fontSize: 36, lineHeight: 42, letterSpacing: -1.1, marginTop: 18 },
  compactTitle: { fontSize: 26, lineHeight: 31, marginTop: 8 },
  compactBody: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  body: { fontFamily: fonts.regular, color: colors.textSecondary, textAlign: "center", fontSize: 16, lineHeight: 24, marginTop: 16 },
  pagination: { flexDirection: "row", justifyContent: "center", paddingVertical: 4 },
  dotTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dot: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  footer: { gap: 4, paddingBottom: 14 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, textAlign: "center", marginTop: 2 },
});
