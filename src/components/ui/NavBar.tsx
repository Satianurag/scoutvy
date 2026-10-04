import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { StepDots } from "@/components/ui/StepDots";
import { colors, fonts, layout } from "@/theme";

type Props = {
  back?: boolean;
  onBack?: () => void;
  title?: string;
  step?: { index: number; count: number };
  onHelp?: () => void;
  action?: { label: string; onPress: () => void; disabled?: boolean };
};

export function NavBar({ back = true, onBack, title, step, onHelp, action }: Props) {
  return (
    <View style={styles.bar}>
      {back && (onBack || router.canGoBack()) ? (
        <Pressable
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          accessibilityRole="button"
          onPress={onBack ?? (() => router.back())}
          accessibilityLabel="Back"
        >
          <Icon
            name={{ ios: "chevron.left", android: "arrow_back_ios_new", web: "arrow_back_ios_new" }}
            size={19}
          />
        </Pressable>
      ) : null}
      {title ? (
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      ) : null}
      {step ? <StepDots index={step.index} count={step.count} /> : null}
      {onHelp ? (
        <Pressable style={({ pressed }) => [styles.help, pressed && styles.pressed]} onPress={onHelp} accessibilityRole="button" accessibilityLabel="Help">
          <Icon
            name={{ ios: "questionmark.circle", android: "help", web: "help" }}
            size={25}
            color={colors.text}
          />
        </Pressable>
      ) : null}
      {action ? (
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          disabled={action.disabled}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityState={{ disabled: action.disabled }}
        >
          <Text style={[styles.actionLabel, action.disabled && styles.actionDisabled]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginTop: layout.navTop,
    height: layout.navHeight,
    alignItems: "center",
    justifyContent: "center",
  },
  back: { position: "absolute", left: layout.gutter, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  help: {
    position: "absolute",
    right: layout.gutter,
    borderRadius: 22,
    backgroundColor: colors.surface,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { maxWidth: "62%", fontFamily: fonts.semiBold, fontSize: 17, color: colors.text },
  action: { position: "absolute", right: layout.gutter, minHeight: 44, justifyContent: "center" },
  actionLabel: { fontFamily: fonts.medium, fontSize: 17, color: colors.primary },
  actionDisabled: { color: colors.tabInactive },
  pressed: { opacity: 0.65 },
});
