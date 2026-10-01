import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { StepDots } from "@/components/ui/StepDots";
import { colors, fonts, layout } from "@/theme";

type Props = {
  back?: boolean;
  title?: string;
  step?: { index: number; count: number };
  onHelp?: () => void;
  action?: { label: string; onPress: () => void; disabled?: boolean };
};

export function NavBar({ back = true, title, step, onHelp, action }: Props) {
  return (
    <View style={styles.bar}>
      {back && router.canGoBack() ? (
        <Pressable style={styles.back} hitSlop={12} onPress={() => router.back()} accessibilityLabel="Back">
          <Icon name={{ ios: "chevron.left", android: "arrow_back_ios_new", web: "arrow_back_ios_new" }} size={19} />
        </Pressable>
      ) : null}
      {title ? (
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      ) : null}
      {step ? <StepDots index={step.index} count={step.count} /> : null}
      {onHelp ? (
        <Pressable style={styles.help} hitSlop={12} onPress={onHelp} accessibilityLabel="Help">
          <Icon name={{ ios: "questionmark.circle", android: "help", web: "help" }} size={25} color={colors.text} />
        </Pressable>
      ) : null}
      {action ? (
        <Pressable
          style={styles.action}
          hitSlop={12}
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
  back: { position: "absolute", left: 14.5 },
  help: { position: "absolute", right: 22.5 },
  title: { maxWidth: "62%", fontFamily: fonts.semiBold, fontSize: 17.5, color: colors.text },
  action: { position: "absolute", right: layout.gutter },
  actionLabel: { fontFamily: fonts.medium, fontSize: 17.5, color: colors.text },
  actionDisabled: { color: colors.tabInactive },
});
