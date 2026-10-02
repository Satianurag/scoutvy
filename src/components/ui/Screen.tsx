import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme";

type Props = PropsWithChildren<{ background?: string; style?: ViewStyle }> & Pick<ViewProps, "onLayout">;

export function Screen({ children, background = colors.background, style, onLayout }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.screen,
        { backgroundColor: background, paddingTop: insets.top, paddingBottom: insets.bottom },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
