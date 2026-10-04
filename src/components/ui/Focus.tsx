import type { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "@/theme";

/** Decorative brand geometry, never a progress or verification indicator. */
export function FocusMark() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants">
    <Svg width={140} height={112} viewBox="0 0 156 128" fill="none">
      <Path d="M35 16H20q-8 0-8 8v16M121 16h15q8 0 8 8v16M12 88v16q0 8 8 8h15M144 88v16q0 8-8 8h-15" stroke={colors.tabInactive} strokeWidth={2} />
      <Rect x={35} y={32} width={86} height={64} rx={14} fill={colors.surface} />
      <Path d="M55 49h34M55 60h24" stroke={colors.textSecondary} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={108} cy={84} r={20} fill={colors.primary} />
      <Path d="M108 76v16m-8-8h16" stroke={colors.onPrimary} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  </View>;
}

export function FocusFrame({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[s.frame, style]}>
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      <View style={[s.corner, s.tl]} /><View style={[s.corner, s.tr]} />
      <View style={[s.corner, s.bl]} /><View style={[s.corner, s.br]} />
    </View>
    {children}
  </View>;
}
const s = StyleSheet.create({
  frame: { padding: 20 },
  corner: { position: "absolute", width: 16, height: 16, borderColor: colors.border },
  tl: { left: 0, top: 0, borderLeftWidth: 1, borderTopWidth: 1, borderTopLeftRadius: 8 },
  tr: { right: 0, top: 0, borderRightWidth: 1, borderTopWidth: 1, borderTopRightRadius: 8 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 1, borderBottomWidth: 1, borderBottomLeftRadius: 8 },
  br: { right: 0, bottom: 0, borderRightWidth: 1, borderBottomWidth: 1, borderBottomRightRadius: 8 },
});
