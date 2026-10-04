import type { PropsWithChildren, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

/** Keep the form and its actions in one scrollable keyboard viewport. */
export function KeyboardForm({ header, footer, contentStyle, children }: PropsWithChildren<{
  header: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}>) {
  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {header}
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, contentStyle]}>
        {children}
        {footer ? <View style={s.actions}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1 },
  actions: { marginTop: "auto", paddingTop: 16 },
});
