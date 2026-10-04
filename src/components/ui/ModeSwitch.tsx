import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { colors, fonts } from "@/theme";

type Option<T extends string> = { value: T; label: string };
export function ModeSwitch<T extends string>({ value, options, onChange }: {
  value: T; options: readonly Option<T>[]; onChange: (value: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex(option => option.value === value));
  const cell = Math.max(0, (width - 8) / options.length);
  const position = useSharedValue(index * cell);
  useEffect(() => { position.set(withSpring(index * cell, {
    duration: 320, dampingRatio: 1, reduceMotion: ReduceMotion.System,
  })); }, [index, cell, position]);
  const rail = useAnimatedStyle(() => ({ transform: [{ translateX: position.value }] }));
  const labels = useAnimatedStyle(() => ({ transform: [{ translateX: -position.value }] }));
  return <View style={s.track} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {options.map(option => <Pressable key={option.value} accessibilityRole="tab"
      accessibilityState={{ selected: value === option.value }} accessibilityLabel={option.label}
      onPress={() => {
        if (option.value === value) return;
        void Haptics.selectionAsync().catch(() => undefined);
        onChange(option.value);
      }} style={({ pressed }) => [s.option, pressed && { opacity: 0.7 }]}>
      <Text style={s.label}>{option.label}</Text>
    </Pressable>)}
    {width > 0 && <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.rail, { width: cell }, rail]}>
      <Animated.View style={[s.railLabels, { width: width - 8 }, labels]}>
        {options.map(option => <View key={option.value} style={s.option}>
          <Text style={[s.label, s.selected]}>{option.label}</Text>
        </View>)}
      </Animated.View>
      <View style={s.leftCorner} /><View style={s.rightCorner} />
    </Animated.View>}
  </View>;
}
const s = StyleSheet.create({
  track: { flexDirection: "row", padding: 4, backgroundColor: colors.surface, borderRadius: 16 },
  rail: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: 12, backgroundColor: colors.primary, overflow: "hidden" },
  railLabels: { flexDirection: "row", height: "100%" },
  option: { flex: 1, minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 21, color: colors.textSecondary, textAlign: "center" },
  selected: { color: colors.onPrimary },
  leftCorner: { position: "absolute", left: 5, top: 5, width: 7, height: 7, borderLeftWidth: 1, borderTopWidth: 1, borderTopLeftRadius: 3, borderColor: "#12102250" },
  rightCorner: { position: "absolute", right: 5, bottom: 5, width: 7, height: 7, borderRightWidth: 1, borderBottomWidth: 1, borderBottomRightRadius: 3, borderColor: "#12102250" },
});
