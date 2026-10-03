import { SheetReveal, useReducedMotion } from "@/components/ui/Motion";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { colors, fonts } from "@/theme";

export type ConfirmationSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "destructive" | "confirm" | "info";
  icon?: "trash" | "signOut" | "info" | "approve" | "refund" | "dispute";
};

const icons = {
  trash: { ios: "trash", android: "delete_outline", web: "delete_outline" },
  signOut: { ios: "rectangle.portrait.and.arrow.right", android: "logout", web: "logout" },
  info: { ios: "info.circle", android: "info", web: "info" },
  approve: { ios: "checkmark.circle", android: "check_circle", web: "check_circle" },
  refund: { ios: "arrow.uturn.backward", android: "undo", web: "undo" },
  dispute: { ios: "flag", android: "outlined_flag", web: "outlined_flag" },
} as const;

export function ConfirmationSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "destructive",
  icon = tone === "destructive" ? "trash" : "info",
}: ConfirmationSheetProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? "none" : "fade"}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <SheetReveal
          accessibilityViewIsModal
          onAccessibilityEscape={onCancel}
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 18) + 12 }]}
        >
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            <View style={s.top}>
              <View style={[s.badge, tone !== "destructive" && s.neutralBadge]}>
                <Icon
                  name={icons[icon]}
                  size={27}
                  color={tone === "destructive" ? colors.danger : colors.primary}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                onPress={onCancel}
                style={({ pressed }) => [s.close, pressed && s.pressed]}
              >
                <Icon
                  name={{ ios: "xmark", android: "close", web: "close" }}
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
            <Text style={s.message}>{message}</Text>
            <Button
              label={tone === "destructive" ? cancelLabel : confirmLabel}
              onPress={tone === "destructive" ? onCancel : onConfirm}
              style={s.keep}
            />
            {tone !== "info" ? (
              <Pressable
                accessibilityRole="button"
                onPress={tone === "destructive" ? onConfirm : onCancel}
                style={({ pressed }) => [
                  s.discard,
                  tone === "confirm" && s.neutralAction,
                  pressed && s.pressed,
                ]}
              >
                <Text style={[s.discardLabel, tone === "confirm" && s.neutralLabel]}>
                  {tone === "destructive" ? confirmLabel : cancelLabel}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </SheetReveal>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.68)" },
  sheet: {
    maxHeight: "90%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  top: { alignItems: "center", marginBottom: 20 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#352725",
    alignItems: "center",
    justifyContent: "center",
  },
  neutralBadge: { backgroundColor: "#302B40" },
  neutralAction: { backgroundColor: colors.surfaceRaised },
  neutralLabel: { color: colors.textSecondary },
  close: {
    position: "absolute",
    right: -8,
    top: -8,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 25,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.text,
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    marginBottom: 28,
    paddingHorizontal: 8,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
  },
  keep: { marginHorizontal: 0, minHeight: 52, borderRadius: 16 },
  discard: {
    minHeight: 52,
    marginTop: 10,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#302725",
  },
  discardLabel: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.danger },
  pressed: { opacity: 0.65 },
});
