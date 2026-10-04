import Animated, { FadeInDown, ReduceMotion, useReducedMotion } from "react-native-reanimated";
import { View, type ViewProps } from "react-native";
export const motion = { fast: 140, standard: 220, screen: 260 };
export function ScreenReveal({ children, style, ...props }: ViewProps) {
  return <View {...props} style={style}>{children}</View>;
}
export function SheetReveal({ children, style, ...props }: ViewProps) {
  return (
    <Animated.View
      {...props}
      entering={FadeInDown.duration(motion.standard)
        .withInitialValues({ transform: [{ translateY: 24 }] })
        .reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
export { useReducedMotion };
