import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { colors, fonts } from "@/theme";

export type UsernameCheck = "available" | "taken" | "invalid" | "checking" | "error" | "unchanged";
export function UsernameFeedback({ status, saveError = false, onRetry }: {
  status: UsernameCheck; saveError?: boolean; onRetry?: () => void;
}) {
  const failed = status === "error";
  const color = status === "available" ? colors.green
    : failed || status === "taken" || status === "invalid" ? colors.danger : colors.textSecondary;
  const message = status === "checking" ? "Checking…"
    : status === "available" ? "Username available"
    : status === "taken" ? "Username taken"
    : failed ? saveError ? "Couldn’t save your username." : "Couldn’t check availability."
    : "3–20 letters, numbers or _";
  return <View style={s.wrap} accessibilityLiveRegion="polite">
    <View style={s.row}>
      {status === "checking" ? <ActivityIndicator size="small" color={color} />
        : status !== "unchanged" ? <Icon size={18} color={color} name={status === "available"
          ? { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" }
          : { ios: "exclamationmark.circle.fill", android: "error", web: "error" }} /> : null}
      <Text style={[s.text, { color }]}>{message}</Text>
    </View>
    {failed && onRetry ? <Pressable accessibilityRole="button" onPress={onRetry}
      style={({ pressed }) => [s.retry, pressed && { opacity: 0.65 }]}>
      <Text style={s.retryText}>{saveError ? "Try again" : "Check again"}</Text>
    </Pressable> : null}
  </View>;
}
const s = StyleSheet.create({
  wrap: { marginHorizontal: 20, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 24 },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20 },
  retry: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center", paddingHorizontal: 8 },
  retryText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.primary },
});
