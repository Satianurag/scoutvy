import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";

type Props = PropsWithChildren<{ order?: number; style?: StyleProp<ViewStyle> }>;

export function Reveal({ order = 0, style, children }: Props) {
  return (
    <Animated.View
      entering={FadeInDown.duration(220)
        .delay(Math.min(order, 3) * 35)
        .reduceMotion(ReduceMotion.System)
        .withInitialValues({ transform: [{ translateY: 14 }] })}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
