import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { layout } from "@/theme";

type Props = PropsWithChildren<{ style?: ViewStyle }>;

export function ListGroup({ children, style }: Props) {
  return <View style={[styles.group, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    marginHorizontal: 16,
    borderRadius: layout.groupRadius,
    overflow: "hidden",
    gap: 1,
  },
});
