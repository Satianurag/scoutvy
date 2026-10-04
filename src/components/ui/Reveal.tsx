import type { PropsWithChildren } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
type Props = PropsWithChildren<{ order?: number; style?: StyleProp<ViewStyle> }>;
export function Reveal({ style, children }: Props) { return <View style={style}>{children}</View>; }
