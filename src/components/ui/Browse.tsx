import { SheetReveal, useReducedMotion } from "@/components/ui/Motion";
import type { PropsWithChildren } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { FocusMark } from "@/components/ui/Focus";
import { colors, fonts } from "@/theme";

export function BrowseHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={s.heading}>
      <View style={s.headingRow}><Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>{action ? <Button label={action.label} onPress={action.onPress} style={s.headingAction} /> : null}</View>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={s.search}>
      <Icon
        name={{ ios: "magnifyingglass", android: "search", web: "search" }}
        size={21}
        color={colors.textSecondary}
      />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        maxLength={100}
        style={s.input}
        selectionColor={colors.primary}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChange("")}
          style={s.clear}
        >
          <Icon
            name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }}
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [s.choice, selected && s.selected, pressed && { opacity: 0.65 }]}
    >
      <Text style={[s.choiceText, selected && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}
export function BrowseEmpty({
  title,
  message,
  action,
  kind = "search",
}: {
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
  kind?: "search" | "activity" | "location" | "block";
}) {
  const compact = useWindowDimensions().height < 650;
  return (
    <View style={[s.empty, compact && { paddingVertical: 16 }]}>
      {!compact && (kind === "search" ? <FocusMark /> : <View style={s.badge}>
        <Icon
          name={
            kind === "block"
              ? { ios: "person.slash", android: "block", web: "block" }
              : kind === "activity"
                ? { ios: "clock", android: "history", web: "history" }
                : kind === "location"
                  ? { ios: "location", android: "location_on", web: "location_on" }
                  : { ios: "magnifyingglass", android: "search", web: "search" }
          }
          size={30}
          color={colors.textSecondary}
        />
      </View>)}
      <Text accessibilityRole="header" style={s.emptyTitle}>
        {title}
      </Text>
      <Text style={s.emptyBody}>{message}</Text>
      {action ? <Button label={action.label} onPress={action.onPress} style={s.emptyButton} /> : null}
    </View>
  );
}
export function BrowseSheet({
  title,
  visible,
  onClose,
  children,
  footer,
}: PropsWithChildren<{ title: string; visible: boolean; onClose: () => void; footer?: React.ReactNode }>) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? "none" : "fade"}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
        <SheetReveal
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={s.handle} />
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              onPress={onClose}
              style={s.clear}
            >
              <Icon name={{ ios: "xmark", android: "close", web: "close" }} size={21} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.sheetBody} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer}
        </SheetReveal>
      </View>
    </Modal>
  );
}
export const browseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingBottom: 24, gap: 16 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20 },
  section: {
    marginHorizontal: 20,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 20,
  },
  groupLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
const s = StyleSheet.create({
  heading: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, gap: 8 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  headingAction: { marginHorizontal: 0, minHeight: 44, paddingHorizontal: 20 },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.7,
    color: colors.text,
  },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  search: {
    marginHorizontal: 20,
    paddingLeft: 14,
    paddingRight: 4,
    minHeight: 50,
    backgroundColor: colors.surface,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 12 },
  clear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  choice: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: "transparent",
    paddingVertical: 10,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  selected: { borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  choiceText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  empty: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 12,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 29,
    color: colors.text,
    textAlign: "left",
  },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
    textAlign: "left",
    marginTop: 0,
    maxWidth: 320,
  },
  emptyButton: { marginHorizontal: 0, marginTop: 8, paddingHorizontal: 24, minHeight: 48, borderRadius: 26 },
  overlay: { flex: 1, backgroundColor: "#00000099", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
    paddingTop: 10,
  },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#454545" },
  sheetHead: { marginHorizontal: 20, flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  sheetTitle: { flex: 1, fontFamily: fonts.semiBold, fontSize: 22, color: colors.text },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 24, gap: 24 },
});
