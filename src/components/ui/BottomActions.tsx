import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { layout } from "@/theme";

export function BottomActions({ children }: PropsWithChildren) {
  return <View style={styles.actions}>{children}</View>;
}

const styles = StyleSheet.create({
  actions: {
    marginTop: "auto",
    paddingBottom: layout.bottomGap,
    gap: layout.buttonGap,
  },
});
