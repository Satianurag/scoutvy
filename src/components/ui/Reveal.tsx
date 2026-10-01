import type { PropsWithChildren } from "react";
import type { ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

type Props = PropsWithChildren<{ order?: number; style?: ViewStyle }>;

export function Reveal({ order = 0, style, children }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(70 * order).withInitialValues({ transform: [{ translateY: 14 }] })} style={style}>
      {children}
    </Animated.View>
  );
}
